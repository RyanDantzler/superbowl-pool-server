// require('dotenv').config();
const express = require('express')();
const cors = require('cors');
const { createServer } = require('http');
const { instrument } = require("@socket.io/admin-ui");
const { v4: uuidv4 } = require('uuid');

const httpServer = createServer();
const io = require('socket.io')(httpServer, {
    cors: {
        origin: ["https://socket-auth.ryandantzler.repl.co", "https://admin.socket.io"],
        credentials: true
    }
});

const { MongoClient } = require('mongodb');
const ObjectID = require('mongodb').ObjectID;

const client = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

var collection, dataCollection, changeStream;

const { initGame, generateNumbers, lockBoard } = require('./game');
const { FRAME_RATE } = require('./constants');
const { generateRoomId } = require('./utils');

const state = {};
let gameData = {};

io.on('connection', socket => {
    console.log(gameData);
    socket.emit("connected", gameData.data.events[0].competitions[0]);

    console.log("socket.io: User connected: ", socket.id);
    
    socket.on('newGame', handleNewGame);
    socket.on('joinGame', handleJoinGame);
    socket.on('getGameLobbies', handleGetGameLobbies);
    socket.on('squareSelected', handleSquareSelected);
    socket.on('squareUnselected', handleSquareUnselected);
    socket.on('lockBoard', handleLockBoard);
    socket.on('drawNumbers', handleDrawNumbers);

    function handleNewGame(settings) {
        let roomId = generateRoomId(8);
        let game = initGame(settings.name, settings.password, settings.user, roomId);

        state[roomId] = game;

        // save game data to server, adds _id to game
        collection.insertOne(state[roomId], (err, doc) => {
            if (err) {
                console.log(err);
            }
        });

        socket.join(roomId);
        socket.emit('initGame', game);
    }

    function handleJoinGame(data) {
        let { game, user } = data;
        let roomId = game.roomId;

        if (!state[roomId]) {
            console.log(`Game ${roomId} not found.`);
            //TODO: send error response
            return;
        }

        if (state[roomId].password !== game.password) {
            socket.emit('incorrectPassword');
            return;
        }

        // try to load existing user
        let loadedUser = state[roomId].players[user.id];

        // check if user exists
        if (!loadedUser) {
            // set new user settings
            user.credits = 10;

            //check if initials are unique, otherwise create unique identifer
            let identifier = user.initials;
            let alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            let i = 0;

            let players = Object.values(state[roomId].players);

            while (players.find(x => x.indentifier === identifier)) {
                identifier = user.firstname.charAt(0) + alphabet.charAt(i++);
            }

            user.identifier = identifier;

            // add new user to game state
            state[roomId].players[user.id] = user;
        }

        socket.join(roomId);
        socket.emit('initGame', state[roomId]);

        // update game in database
        collection.updateOne(
            { "_id": state[roomId]._id },
            { $set: { players: state[roomId].players } }
        );
    }

    function handleSquareSelected(data) {
        const { user, squareId } = data;
        let roomId = [...socket.rooms].slice(1,)[0];

        if (!state[roomId]) {
            console.log(`Game ${roomId} not found.`);
            //TODO: send error response
            return;
        }

        let value = state[roomId].board[Math.floor(squareId / 10)][squareId % 10];

        if (value == 0) {
            console.log(`stateUpdate: ${squareId} by ${user.indentifier}`);

            // update square
            state[roomId].board[Math.floor(squareId / 10)][squareId % 10] = user.identifier;

            // charge user credit for selected square
            state[roomId].players[user.id].credits--;

            // emit boardchanged event to entire game room
            socket.to(roomId).emit("stateUpdate", data);

            // update game in database
            collection.updateOne(
                { "_id": state[roomId]._id },
                {
                    $set: {
                        board: state[roomId].board,
                        players: state[roomId].players
                    }
                });
        } else {
            // send error
            console.log('selectionError');
            socket.emit('selectionError', state[roomId]);
        }
    }

    function handleSquareUnselected(data) {
        const { user, squareId } = data;
        let roomId = [...socket.rooms].slice(1,)[0];

        if (!state[roomId]) {
            console.log(`Game ${roomId} not found.`);
            //TODO: send error response
            return;
        }

        console.log(`stateUpdate: ${squareId} by ${user.indentifier}`);

        // clear square
        state[roomId].board[Math.floor(squareId / 10)][squareId % 10] = 0;

        // refund user credit for unselected square
        state[roomId].players[user.id].credits++;

        // emit boardchanged event to entire game room
        socket.to(roomId).emit("stateUpdate", { squareId: squareId, user: null });

        // update game in database
        collection.updateOne(
            { "_id": state[roomId]._id },
            {
                $set: {
                    board: state[roomId].board,
                    players: state[roomId].players
                }
            });
    }

    function handleGetGameLobbies() {
        emitGameLobbies(socket);
    }

    function handleDrawNumbers() {
        let roomId = [...socket.rooms].slice(1,)[0];

        if (!state[roomId]) {
            console.log(`Game ${roomId} not found.`);
            //TODO: send error response
            return;
        }

        generateNumbers(state[roomId]);

        // update game in database
        collection.updateOne(
            { "_id": state[roomId]._id },
            { $set: { numbers: state[roomId].numbers } }
        );

        io.in(roomId).emit('drawNumbers', state[roomId].numbers);
    }

    function handleLockBoard() {
        let roomId = [...socket.rooms].slice(1,)[0];

        if (!state[roomId]) {
            console.log(`Game ${roomId} not found.`);
            //TODO: send error response
            return;
        }

        lockBoard(state[roomId]);

        // update game in database
        collection.updateOne(
            { "_id": state[roomId]._id },
            { $set: { locked: state[roomId].locked } }
        );

        io.in(roomId).emit('boardLocked');
    }

    socket.on("disconnect", () => {
        console.log("socket.io: User disconnected: ", socket.id);
      });
});

io.of("/").adapter.on("join-room", (room, id) => {
    console.log(`socket ${id} has joined room ${room}`);
});

function emitGameLobbies(socket) {
    socket.emit('gameLobbies', state);
}

//TODO: emit notification to game winners with prizes
// function emitGameOver(roomId, winner) {
//     io.sockets.in(roomId)
//         .emit('gameOver', { winner });
// }

instrument(io, {
    auth: false
});

async function loadGames() {
    console.log("loading games...");
    const games = await collection.find().toArray();

    for (let i = 0; i < games.length; i++) {
        console.log(`${games[i].name} loaded.`);
        state[games[i].roomId] = games[i];
    }
}

async function loadGameData() {
    console.log("loading game data...");
    gameData = await dataCollection.findOne({}, { sort: { "date": -1 } });
}

httpServer.listen(process.env.PORT || 3030, async () => {
    try {
        await client.connect();
        collection = client.db('superBowlPool').collection('games');
        dataCollection = client.db('espnScoreboard').collection('nfl');
        changeStream = await client.db('espnScoreboard').collection('nfl').watch();
        changeStream.on("change", (change) => {
            if (change.operationType == "insert") {
              console.log("new document inserted.");
              console.log(change.fullDocument.data.events[0].competitions[0]);
                io.emit('gameDataUpdate', change.fullDocument.data.events[0].competitions[0]);
            } else {
              console.log(change.operationType);
            }
        });
        loadGames();
        loadGameData();
        console.log("Listening on port: %s", httpServer.address().port);
    } catch (e) {
        console.log(e);
    }
});