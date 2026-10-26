(function (root) {
    'use strict';
    const isPowerOfTwo = number => Number.isInteger(number) && number > 0 && (number & (number - 1)) === 0;
    function createGame(rows, cols, starter = 1, round = 1) {
        if (![rows, cols].every(n => isPowerOfTwo(n) && n <= 16)) throw new Error('Choose side lengths of 1, 2, 4, 8 or 16.');
        if (![1, 2].includes(starter)) throw new Error('Choose Player 1 or Player 2 to start.');
        return { rows, cols, starter, round, turn: starter, board: '0'.repeat(rows * cols), revision: 0, winner: 0, loser: 0, moves: {} };
    }
    function rectangle(first, second) {
        return { top: Math.min(first.row, second.row), bottom: Math.max(first.row, second.row), left: Math.min(first.col, second.col), right: Math.max(first.col, second.col) };
    }
    const remaining = game => [...game.board].filter(cell => cell === '0').length;
    function inspectMove(game, rect) {
        if (!rect || !['top', 'bottom', 'left', 'right'].every(key => Number.isInteger(rect[key]))) return { valid: false, message: 'Choose two opposite corners first.' };
        const { top, bottom, left, right } = rect;
        if (top < 0 || left < 0 || bottom >= game.rows || right >= game.cols || bottom < top || right < left) return { valid: false, message: 'Keep your rectangle inside the board.' };
        const height = bottom - top + 1, width = right - left + 1, area = height * width;
        const cells = [];
        for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) cells.push(row * game.cols + col);
        const result = { height, width, area, cells, exponent: Math.log2(area), finishes: area === remaining(game) };
        if (game.winner) return { ...result, valid: false, message: 'This round has finished.' };
        if (cells.some(index => game.board[index] !== '0')) return { ...result, valid: false, message: 'That rectangle overlaps a shaded square. Choose empty squares only.' };
        if (!isPowerOfTwo(area)) return { ...result, valid: false, message: `${height} × ${width} = ${area}. Choose an area of 1, 2, 4, 8, 16, …` };
        return { ...result, valid: true, message: `${height} × ${width} = ${area} = 2^${Math.log2(area)}` };
    }
    function playMove(game, rect, player) {
        if (player !== game.turn) throw new Error('It is the other player’s turn.');
        const result = inspectMove(game, rect);
        if (!result.valid) throw new Error(result.message);
        const board = [...game.board];
        result.cells.forEach(index => { board[index] = String(player); });
        const revision = game.revision + 1;
        const move = { ...rect, player, area: result.area, number: revision };
        return { ...game, board: board.join(''), revision, turn: result.finishes ? player : 3 - player,
            loser: result.finishes ? player : 0, winner: result.finishes ? 3 - player : 0,
            moves: { ...(game.moves || {}), ['move' + revision]: move } };
    }
    function requireRoom(room) {
        if (!room || room.type !== 'power-grid' || room.version !== 1) throw new Error('Power Grid room not found. Check the code.');
    }
    function roleFor(room, id) {
        if (room?.players?.one === id) return 1;
        if (room?.players?.two === id) return 2;
        return 0;
    }
    function createRoom(rows, cols, id) {
        return { type: 'power-grid', version: 1, players: { one: id }, game: createGame(rows, cols), rematch: {} };
    }
    function joinRoom(room, id) {
        requireRoom(room);
        if (roleFor(room, id)) return room;
        if (room.players.two) throw new Error('This room already has two players. Reopen your original tab to return to your seat.');
        return { ...room, players: { ...room.players, two: id } };
    }
    function moveInRoom(room, id, rect, round, revision) {
        requireRoom(room);
        const role = roleFor(room, id);
        if (!role) throw new Error('Join the room before playing.');
        if (!room.players.two) throw new Error('Wait for your friend to join.');
        if (room.game.round !== round || room.game.revision !== revision) throw new Error('The board changed. Choose your rectangle again.');
        return { ...room, game: playMove(room.game, rect, role) };
    }
    function requestRematch(room, id, round) {
        requireRoom(room);
        const role = roleFor(room, id);
        if (!role) throw new Error('Join the room before playing.');
        if (!room.game.winner || room.game.round !== round) throw new Error('Wait until this round has finished.');
        const rematch = { ...(room.rematch || {}), ['p' + role]: true };
        if (rematch.p1 && rematch.p2) return { ...room, rematch: {}, game: createGame(room.game.rows, room.game.cols, 3 - room.game.starter, round + 1) };
        return { ...room, rematch };
    }
    const rules = { isPowerOfTwo, createGame, rectangle, remaining, inspectMove, playMove, roleFor, createRoom, joinRoom, moveInRoom, requestRematch };
    if (typeof module !== 'undefined' && module.exports) module.exports = rules;
    else root.PowerGrid = rules;
})(typeof globalThis !== 'undefined' ? globalThis : this);
