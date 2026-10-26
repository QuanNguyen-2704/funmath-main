const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../power-grid-rules.js');
const Online = require('../power-grid-online.js');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const rect = (top, left, bottom = top, right = left) => ({ top, left, bottom, right });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('board sizes, rectangle normalization and area checks', () => {
    for (const rows of [1, 2, 4, 8, 16]) for (const cols of [1, 2, 4, 8, 16]) {
        const game = R.createGame(rows, cols);
        assert.equal(game.board.length, rows * cols);
        assert.equal(R.remaining(game), rows * cols);
    }
    for (const n of [0, 3, -2, 32, 1.5, NaN]) assert.throws(() => R.createGame(n, 4));
    assert.deepEqual(R.rectangle({ row: 3, col: 2 }, { row: 1, col: 0 }), rect(1, 0, 3, 2));
    const game = R.createGame(4, 8);
    for (let height = 1; height <= 4; height++) for (let width = 1; width <= 8; width++) {
        const result = R.inspectMove(game, rect(0, 0, height - 1, width - 1));
        assert.equal(result.valid, Number.isInteger(Math.log2(height * width)));
    }
    for (const invalid of [null, rect(-1, 0), rect(0, 0, 4, 2), rect(1, 1, 0, 0), rect(0.5, 0)]) assert.equal(R.inspectMove(game, invalid).valid, false);
});

test('the exact six-move example in the supplied image ends with Player 1 winning', () => {
    let game = R.createGame(4, 4);
    const moves = [rect(0, 1, 1, 2), rect(0, 0, 3, 0), rect(2, 2, 3, 3), rect(0, 3), rect(2, 1, 3, 1), rect(1, 3)];
    for (const move of moves) game = R.playMove(game, move, game.turn);
    assert.equal(game.winner, 1);
    assert.equal(game.loser, 2);
    assert.equal(game.revision, 6);
    assert.equal(R.remaining(game), 0);
    assert.throws(() => R.playMove(game, rect(0, 0), game.turn), /finished/);
});

test('moves are immutable; overlaps, wrong turns, and non-power areas do not change the board', () => {
    const original = R.createGame(4, 4);
    const game = R.playMove(original, rect(0, 0, 1, 1), 1);
    assert.equal(original.board, '0'.repeat(16));
    assert.equal(original.revision, 0);
    const saved = JSON.stringify(game);
    assert.throws(() => R.playMove(game, rect(0, 0), 2), /overlaps/);
    assert.throws(() => R.playMove(game, rect(2, 0), 1), /other player/);
    assert.throws(() => R.playMove(game, rect(2, 0, 2, 2), 2), /area/);
    assert.equal(JSON.stringify(game), saved);
    assert.equal(R.inspectMove(original, rect(0, 0, 3, 3)).finishes, true);
});

test('filling the last square loses, including a one-square board and a whole-board move', () => {
    for (const size of [1, 2, 4]) {
        const game = R.playMove(R.createGame(size, size), rect(0, 0, size - 1, size - 1), 1);
        assert.equal(game.winner, 2);
        assert.equal(game.loser, 1);
    }
});

test('room seats, stale turns and rematch consensus', () => {
    let room = R.createRoom(2, 2, 'host');
    assert.throws(() => R.moveInRoom(room, 'host', rect(0, 0), 1, 0), /Wait for your friend/);
    room = R.joinRoom(room, 'guest');
    assert.equal(R.joinRoom(room, 'host'), room);
    assert.equal(R.joinRoom(room, 'guest'), room);
    assert.throws(() => R.joinRoom(room, 'third'), /two players/);
    assert.throws(() => R.moveInRoom(room, 'stranger', rect(0, 0), 1, 0), /Join/);
    assert.throws(() => R.moveInRoom(room, 'guest', rect(0, 0), 1, 0), /other player/);
    room = R.moveInRoom(room, 'host', rect(0, 0, 1, 1), 1, 0);
    assert.throws(() => R.moveInRoom(room, 'guest', rect(0, 0), 1, 0), /board changed/);
    room = R.requestRematch(room, 'host', 1);
    assert.equal(room.game.winner, 2);
    room = R.requestRematch(room, 'guest', 1);
    assert.equal(room.game.round, 2);
    assert.equal(room.game.turn, 2);
    assert.equal(room.game.revision, 0);
    assert.throws(() => R.moveInRoom(room, 'guest', rect(0, 0), 1, 0), /board changed/);
    assert.throws(() => R.requestRematch(room, 'guest', 1), /finished/);
    for (const code of ['ABC234', 'abc234', ' ABC234 ']) assert.equal(Online.normalizeCode(code), 'ABC234');
    for (const code of ['', 'ABC', '../ABC', 'ABC123', 'ABC23.']) assert.throws(() => Online.normalizeCode(code));
});

// Simulates Firebase's transaction retry and snapshot contracts, not a real server.
function fakeFirebase() {
    let root = {}, version = 0, connected = true;
    const listeners = new Set();
    const read = path => path === '.info/connected' ? connected : path.split('/').reduce((value, key) => value?.[key], root) ?? null;
    const snap = path => ({ val: () => structuredClone(read(path)), exists: () => read(path) !== null });
    const emit = sub => {
        const value = JSON.stringify(read(sub.path));
        if (listeners.has(sub) && sub.last !== value) { sub.last = value; sub.callback(snap(sub.path)); }
    };
    const notify = () => { for (const sub of listeners) queueMicrotask(() => emit(sub)); };
    const write = (path, value) => {
        const keys = path.split('/'); let target = root;
        for (const key of keys.slice(0, -1)) target = target[key] ||= {};
        target[keys.at(-1)] = structuredClone(value); version++; notify();
    };
    const sdk = {
        ref: (_, path) => path,
        get: async path => snap(path),
        set: async (path, value) => write(path, value),
        onDisconnect: () => ({ set: async () => {}, cancel: async () => {} }),
        onValue(path, callback) { const sub = { path, callback }; listeners.add(sub); queueMicrotask(() => emit(sub)); return () => listeners.delete(sub); },
        async runTransaction(path, update, options) {
            assert.equal(options.applyLocally, false);
            for (let tries = 0; tries < 20; tries++) {
                const seen = version, next = update(structuredClone(read(path)));
                await Promise.resolve();
                if (seen !== version) continue;
                if (next === undefined) return { committed: false, snapshot: snap(path) };
                write(path, next);
                return { committed: true, snapshot: snap(path) };
            }
            throw new Error('Too many retries');
        }
    };
    return { sdk, read, connect(value) { connected = value; notify(); } };
}

test('online transport: two clients sync, competing moves commit once, seats recover and rematches sync', async () => {
    const server = fakeFirebase();
    const states = { host: [], guest: [], third: [] };
    const storage = () => { const map = new Map(); return { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) }; };
    const hostStorage = storage(), errors = [];
    function make(who, store = storage()) {
        return Online.createClient({ sdk: server.sdk, db: {}, storage: store, makeId: () => who, makeCode: () => 'ABC234', onRoom: (room, role) => states[who].push({ room, role }), onConnection() {}, onError: error => errors.push(error) });
    }
    const host = make('host', hostStorage), guest = make('guest'), third = make('third');
    assert.equal(await host.create(2, 2), 'ABC234'); await tick();
    await assert.rejects(host.move(rect(0, 0), 1, 0), /Wait for your friend/);
    await guest.join('abc234'); await tick();
    assert.equal(states.host.at(-1).role, 1);
    assert.equal(states.guest.at(-1).role, 2);
    await assert.rejects(third.join('ABC234'), /two players/);
    const attempts = await Promise.allSettled([host.move(rect(0, 0), 1, 0), host.move(rect(1, 1), 1, 0)]);
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    await tick();
    assert.deepEqual(states.host.at(-1).room.game, states.guest.at(-1).room.game);
    assert.equal(states.host.at(-1).room.game.revision, 1);
    await guest.move(rect(0, 1), 1, 1);
    await host.move(rect(1, 0), 1, 2);
    await guest.move(rect(1, 1), 1, 3);
    await host.rematch(1); await guest.rematch(1); await tick();
    assert.equal(states.host.at(-1).room.game.round, 2);
    assert.equal(states.guest.at(-1).room.game.turn, 2);
    host.close(); await tick();
    const recovered = make('host', hostStorage);
    await recovered.join('ABC234'); await tick();
    assert.equal(states.host.at(-1).role, 1);
    server.connect(false); await tick();
    await assert.rejects(recovered.move(rect(0, 0), 2, 0), /Reconnecting/);
    server.connect(true); await tick();
    await guest.move(rect(0, 0), 2, 0); await tick();
    assert.equal(states.host.at(-1).room.game.revision, 1);
    assert.deepEqual(errors, []);
    recovered.close(); guest.close(); third.close();
});

test('online transport: missing rooms and code collisions leave existing data alone', async () => {
    const server = fakeFirebase();
    const config = { sdk: server.sdk, db: {}, makeId: () => 'host', makeCode: () => 'ABC234', onRoom() {}, onConnection() {}, onError() {} };
    const first = Online.createClient(config), second = Online.createClient({ ...config, makeId: () => 'other' });
    await assert.rejects(first.join('DEF234'), /not found/);
    await first.create(4, 4); await tick();
    await assert.rejects(second.create(8, 8), /reserve/);
    assert.equal(server.read('rooms/power-grid-ABC234').game.rows, 4);
    first.close(); second.close();
});

// DOM event smoke tests; layout still needs checking in a real browser.
function loadUI(online = false) {
    class Element {
        constructor() {
            this.children = []; this.listeners = {}; this.attributes = {}; this.className = ''; this.value = ''; this.dataset = {}; this.disabled = false; this.hidden = false; this._text = '';
            this.style = { setProperty() {} };
            this.classList = {
                add: name => { this.className += ' ' + name; },
                toggle: (name, enabled) => { this.className = this.className.split(' ').filter(value => value && value !== name).concat(enabled ? [name] : []).join(' '); }
            };
        }
        set textContent(value) { this._text = String(value); this.children = []; }
        get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
        appendChild(child) { this.children.push(child); return child; }
        replaceChildren() { this.children = []; this._text = ''; }
        contains(child) { return this === child || this.children.some(value => value.contains(child)); }
        querySelector(selector) { if (selector === 'button') return this.children.find(value => value.isButton); return null; }
        setAttribute(key, value) { this.attributes[key] = String(value); }
        addEventListener(name, handler) { this.listeners[name] = handler; }
        focus() { document.activeElement = this; this.listeners.focus?.(); }
        async fire(name = 'click', properties = {}) { if (name === 'click' && this.disabled) return; return this.listeners[name]?.({ preventDefault() {}, ...properties }); }
        select() {}
    }
    const html = fs.readFileSync(path.join(__dirname, '../power-grid.html'), 'utf8');
    const elements = {};
    for (const match of html.matchAll(/\bid="([^"]+)"/g)) elements[match[1]] = new Element();
    const joinButton = new Element(); joinButton.isButton = true; elements['join-form'].appendChild(joinButton);
    elements.rows.value = elements.cols.value = '4';
    const document = { activeElement: null, getElementById: id => elements[id], createElement: () => new Element() };
    const location = { href: 'http://localhost/power-grid.html' + (online ? '?mode=online&room=ABC234' : ''), search: online ? '?mode=online&room=ABC234' : '' };
    const context = { document, location, history: { replaceState(_, __, url) { location.href = String(url); location.search = new URL(url).search; } }, URL, URLSearchParams, navigator: {}, PowerGrid: R, PowerGridOnline: Online, addEventListener() {} };
    context.window = context;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../power-grid-ui.js'), 'utf8'), context);
    return { el: elements, document, location, corner: index => elements.board.children[index].fire(), submit: () => elements.shade.fire() };
}

test('local UI: two-corner preview, invalid selection, move history and losing warning', async () => {
    const { el, corner, submit } = loadUI();
    assert.equal(el.board.children.length, 16);
    assert.match(el['turn-status'].textContent, /Player 1/);
    await corner(0); await corner(10);
    assert.equal(el.shade.disabled, true);
    assert.match(el['selection-summary'].textContent, /area of/);
    await el['clear-selection'].fire();
    await corner(1); await corner(6);
    assert.equal(el.shade.disabled, false);
    assert.match(el['selection-summary'].textContent, /2 × 2 = 4/);
    await submit();
    assert.equal(el['empty-count'].textContent, '12');
    assert.equal(el['history-list'].children.length, 1);
    assert.match(el['turn-status'].textContent, /Player 2/);
    await corner(1); await corner(6);
    assert.equal(el.shade.disabled, true);
    assert.match(el['selection-summary'].textContent, /overlaps/);
    el.rows.value = el.cols.value = '1';
    await el['start-local'].fire();
    await corner(0); await corner(0);
    assert.match(el['selection-summary'].textContent, /will lose/);
    assert.match(el.shade.textContent, /you lose/);
    await submit();
    assert.match(el['turn-status'].textContent, /Player 2 wins/);
    assert.equal(el.rematch.hidden, false);
    await el.rematch.fire();
    assert.match(el['turn-status'].textContent, /Player 2’s turn/);
});

test('UI: invite lobby preserves code, mode switching and keyboard arrows work', async () => {
    const { el, document, location } = loadUI(true);
    assert.equal(el['join-code'].value, 'ABC234');
    assert.equal(el['join-form'].hidden, false);
    assert.equal(el['start-local'].hidden, true);
    assert.equal(el.shade.disabled, true);
    await el['mode-local'].fire();
    assert.equal(el['start-local'].hidden, false);
    assert.equal(location.search, '');
    el.board.children[0].focus();
    await el.board.children[0].fire('keydown', { key: 'ArrowRight' });
    assert.equal(document.activeElement, el.board.children[1]);
    await el.board.children[1].fire('keydown', { key: 'ArrowDown' });
    assert.equal(document.activeElement, el.board.children[5]);
});
