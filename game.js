const { GRID_SIZE, PAYOUT_STRUCTURE, CURRENCY_UNIT, CURRENCY_SYMBOL } = require('./constants');

function initGame(name, password, host, roomId) {
    const state = createGameState(name, password, host, roomId);
    return state;
}

function createGameState(name, password, host, roomId) {
    return {
        name: name,
        password: password,
        host: host.firstname,
        roomId: roomId,
        // board: [
        //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        //   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        // ],
        board: [
            ["CG", 0, 0, 0, 0, "KG", 0, 0, "LD", 0],
            [0, "LD", "DM", 0, 0, 0, 0, "DM", 0, 0],
            [0, 0, "CG", 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, "JG", 0, 0, "RD", 0, 0],
            ["MD", 0, 0, "RD", 0, 0, 0, 0, 0, "CG"],
            [0, 0, 0, 0, "DM", 0, 0, "RD", "LD", 0],
            [0, "JG", 0, 0, 0, 0, "MD", 0, 0, "JG"],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, "LD", 0, "KG", 0, 0],
            ["KG", 0, "RD", 0, 0, 0, 0, 0, "MD", 0]
        ],
        players: {
            [host.id]: {
                ...host,
                identifier: host.initials,
                credits: 10
            }
        },
        numbers: [],
        winners: [],
        payoutStructure: PAYOUT_STRUCTURE,
        costPerSquare: 0,
        currencyUnit: CURRENCY_UNIT,
        currencySymbol: CURRENCY_SYMBOL,
        gridsize: GRID_SIZE,
        locked: false
    };
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

function generateNumbers(state) {
    if (state.numbers.length > 0) {
        return;
    }

    let rowNums = [...Array(Math.sqrt(GRID_SIZE)).keys()];
    let colNums = [...Array(Math.sqrt(GRID_SIZE)).keys()];
    shuffleArray(rowNums);
    shuffleArray(colNums);

    console.log(rowNums);
    console.log(colNums);

    state.numbers = [rowNums, colNums];
}

function lockBoard(state) {
    if (state.locked) {
        return;
    }

    let players = {};

    for (const player in state.players) {
        players[player] = { ...state.players[player], credits: 0 };
    }

    state.players = players;
    state.locked = true;
}

module.exports = {
    initGame,
    generateNumbers,
    lockBoard
}