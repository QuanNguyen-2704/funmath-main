(function () {
    'use strict';
    const R = window.PowerGrid, Online = window.PowerGridOnline;
    const el = id => document.getElementById(id);
    let mode = 'local', game = R.createGame(4, 4), room = null, role = 0, client = null;
    let first = null, second = null, busy = false, connected = false, generation = 0, focusIndex = 0;
    let sdkPromise;
    const dimensions = () => [Number(el('rows').value), Number(el('cols').value)];
    const canPlay = () => !busy && !game.winner && (mode === 'local' || (room?.players.two && connected && game.turn === role));
    const selection = () => first && second ? R.rectangle(first, second) : null;
    function message(text = '') { el('game-message').textContent = text; }
    function errorText(error) {
        if (/permission/i.test(error.message)) return 'Online rooms are unavailable. Please ask your teacher to check room access.';
        if (/fetch|import|network/i.test(error.message)) return 'Online play could not load. Check your connection and try again. Same-device play still works.';
        return error.message || 'Something went wrong. Please try again.';
    }
    function clearSelection() { first = second = null; }
    function setMode(next) {
        generation++;
        if (client) client.close();
        client = null; room = null; role = 0; connected = false; busy = false; mode = next;
        clearSelection(); message(); el('lobby-message').textContent = '';
        game = R.createGame(...dimensions());
        const url = new URL(location.href);
        url.searchParams.delete('room');
        if (next === 'online') url.searchParams.set('mode', 'online'); else url.searchParams.delete('mode');
        history.replaceState(null, '', url);
        render();
    }
    function render() {
        const online = mode === 'online';
        el('mode-local').setAttribute('aria-pressed', !online);
        el('mode-online').setAttribute('aria-pressed', online);
        el('mode-local').disabled = el('mode-online').disabled = busy;
        el('rows').disabled = el('cols').disabled = busy || (online && !!room);
        el('start-local').hidden = online;
        el('create-room').hidden = !online || !!room;
        el('join-form').hidden = !online || !!room;
        el('room-details').hidden = !online || !room;
        el('start-local').disabled = el('create-room').disabled = busy;
        el('join-form').querySelector('button').disabled = busy;
        el('join-code').disabled = busy;
        el('leave-room').disabled = busy;
        el('mode-note').textContent = online ? 'Create a room, then share its code or invite link.' : 'Pass the device after each turn.';
        el('p1-count').textContent = `${[...game.board].filter(n => n === '1').length} squares`;
        el('p2-count').textContent = `${[...game.board].filter(n => n === '2').length} squares`;
        el('empty-count').textContent = R.remaining(game);
        el('player-one').classList.toggle('active', !game.winner && game.turn === 1);
        el('player-two').classList.toggle('active', !game.winner && game.turn === 2);
        let status;
        if (online && !room) status = 'Create or join a room to play online.';
        else if (online && !connected) status = 'Reconnecting… moves are paused.';
        else if (online && !room.players.two) status = 'You are Player 1. Waiting for your friend to join…';
        else if (game.winner) status = `Player ${game.winner} wins! Player ${game.loser} shaded the last square.${online ? game.winner === role ? ' You won! 🏆' : ' Try again in the next round!' : ' 🏆'}`;
        else status = online ? game.turn === role ? `Your turn · Player ${role}` : `Player ${game.turn}’s turn · wait for your friend` : `Player ${game.turn}’s turn`;
        el('turn-status').textContent = status;
        el('turn-status').classList.toggle('finished', !!game.winner);
        if (room) {
            el('seat-label').textContent = `You are Player ${role} · Round ${game.round}${room.players.two && room.presence?.[room.players[role === 1 ? 'two' : 'one']] === false ? ' · Friend disconnected; their seat is saved.' : ''}`;
        }
        renderBoard(); renderSelection();
        el('clear-selection').disabled = busy || !first;
        el('rematch').hidden = !game.winner;
        el('rematch').disabled = busy || (online && (!connected || !!room?.rematch?.['p' + role]));
        el('rematch').textContent = online ? room?.rematch?.['p' + role] ? 'Waiting for your friend…' : room?.rematch?.['p' + (3 - role)] ? 'Accept rematch' : 'Request rematch' : 'Play again · swap who starts';
        const moves = Object.values(game.moves || {}).sort((a, b) => b.number - a.number);
        el('move-count').textContent = moves.length;
        el('history-empty').hidden = !!moves.length;
        el('history-list').replaceChildren();
        moves.forEach(move => {
            const item = document.createElement('li');
            item.value = move.number;
            item.textContent = `P${move.player}: ${move.bottom - move.top + 1} × ${move.right - move.left + 1} = ${move.area} · row ${move.top + 1}, column ${move.left + 1}`;
            el('history-list').appendChild(item);
        });
    }
    function renderBoard() {
        const board = el('board');
        const oldFocus = board.contains(document.activeElement);
        const rect = selection(), inspected = rect ? R.inspectMove(game, rect) : null;
        const latest = game.moves?.['move' + game.revision];
        board.style.setProperty('--cols', game.cols);
        board.replaceChildren();
        for (let index = 0; index < game.board.length; index++) {
            const row = Math.floor(index / game.cols), col = index % game.cols;
            const button = document.createElement('button');
            const selected = rect && row >= rect.top && row <= rect.bottom && col >= rect.left && col <= rect.right;
            button.className = `cell${selected ? inspected.valid ? ' selected' : ' invalid' : ''}${first?.row === row && first?.col === col ? ' anchor' : ''}`;
            if (latest && row >= latest.top && row <= latest.bottom && col >= latest.left && col <= latest.right) button.classList.add('last-move');
            button.dataset.player = game.board[index];
            button.textContent = game.board[index] === '1' ? '●' : game.board[index] === '2' ? '■' : '';
            button.tabIndex = index === focusIndex ? 0 : -1;
            button.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}, ${game.board[index] === '0' ? 'empty' : 'shaded by Player ' + game.board[index]}`);
            button.setAttribute('aria-pressed', !!selected);
            button.setAttribute('aria-disabled', !canPlay());
            button.addEventListener('focus', () => { focusIndex = index; });
            button.addEventListener('click', () => {
                if (!canPlay()) return;
                focusIndex = index; message();
                if (!first || second) { first = { row, col }; second = null; }
                else second = { row, col };
                render();
                board.children[focusIndex].focus({ preventScroll: true });
            });
            button.addEventListener('keydown', event => {
                const offsets = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
                if (event.key === 'Escape') { clearSelection(); render(); return; }
                if (!offsets[event.key]) return;
                event.preventDefault();
                const [dr, dc] = offsets[event.key];
                const next = Math.max(0, Math.min(game.rows - 1, row + dr)) * game.cols + Math.max(0, Math.min(game.cols - 1, col + dc));
                board.children[focusIndex].tabIndex = -1;
                focusIndex = next; board.children[next].tabIndex = 0; board.children[next].focus();
            });
            board.appendChild(button);
        }
        if (oldFocus) board.children[Math.min(focusIndex, game.board.length - 1)].focus({ preventScroll: true });
    }
    function renderSelection() {
        const rect = selection(), result = rect ? R.inspectMove(game, rect) : null;
        let text = !canPlay() ? 'Your next rectangle will appear here.' : first ? 'Now tap the opposite corner (or tap the same square for 1 × 1).' : 'Choose your first corner.';
        if (result) text = result.valid ? `${result.message}. ${result.finishes ? `Careful! This fills the board. Player ${game.turn} will lose.` : 'Ready to shade!'}` : result.message;
        el('selection-summary').textContent = text;
        el('selection-summary').className = `selection-summary${result ? result.valid ? ' valid' : ' invalid' : ''}`;
        el('shade').disabled = !canPlay() || !result?.valid;
        el('shade').textContent = result?.valid && result.finishes ? 'Shade anyway · you lose' : 'Shade rectangle';
        el('shade').classList.toggle('danger', !!result?.valid && result.finishes);
    }
    async function perform(action, target = 'game') {
        if (busy) return;
        busy = true; render();
        if (target === 'lobby') el('lobby-message').textContent = 'Connecting…'; else message('Sending…');
        try { await action(); if (target === 'lobby') el('lobby-message').textContent = ''; else message(); }
        catch (error) { if (target === 'lobby') el('lobby-message').textContent = errorText(error); else message(errorText(error)); }
        finally { busy = false; render(); }
    }
    async function prepareClient() {
        if (client) client.close();
        const currentGeneration = ++generation;
        if (!sdkPromise) sdkPromise = Online.loadFirebase().catch(error => { sdkPromise = null; throw error; });
        const { sdk, db } = await sdkPromise;
        await Online.waitForConnection(sdk, db);
        let storage;
        try { storage = sessionStorage; } catch (_) { /* Optional seat recovery. */ }
        client = Online.createClient({ sdk, db, storage,
            onRoom(value, myRole, code) {
                if (generation !== currentGeneration) return;
                if (game.round !== value.game.round || game.revision !== value.game.revision) clearSelection();
                room = value; role = myRole; game = value.game;
                focusIndex = Math.min(focusIndex, game.board.length - 1);
                el('rows').value = game.rows; el('cols').value = game.cols;
                el('room-code').textContent = code;
                const url = new URL(location.href); url.searchParams.set('mode', 'online'); url.searchParams.set('room', code);
                history.replaceState(null, '', url);
                el('share-link').value = url.href;
                render();
            },
            onConnection(value) { if (generation === currentGeneration) { connected = value; if (!value) clearSelection(); render(); } },
            onError(error) { if (generation === currentGeneration) { connected = false; el('lobby-message').textContent = errorText(error); render(); } }
        });
    }
    el('mode-local').addEventListener('click', () => setMode('local'));
    el('mode-online').addEventListener('click', () => setMode('online'));
    el('start-local').addEventListener('click', () => { game = R.createGame(...dimensions()); focusIndex = 0; clearSelection(); message(); render(); });
    el('clear-selection').addEventListener('click', () => { clearSelection(); render(); });
    el('shade').addEventListener('click', () => perform(async () => {
        const rect = selection();
        if (!rect) return;
        if (mode === 'local') game = R.playMove(game, rect, game.turn);
        else await client.move(rect, game.round, game.revision);
        clearSelection();
    }));
    el('create-room').addEventListener('click', () => perform(async () => { await prepareClient(); await client.create(...dimensions()); }, 'lobby'));
    el('join-form').addEventListener('submit', event => {
        event.preventDefault();
        perform(async () => { const code = Online.normalizeCode(el('join-code').value); await prepareClient(); await client.join(code); }, 'lobby');
    });
    el('leave-room').addEventListener('click', () => setMode('online'));
    el('rematch').addEventListener('click', () => perform(async () => {
        if (mode === 'online') await client.rematch(game.round);
        else game = R.createGame(game.rows, game.cols, 3 - game.starter, game.round + 1);
        clearSelection();
    }));
    el('copy-link').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(el('share-link').value); el('lobby-message').textContent = 'Invite link copied! Send it to your friend.'; }
        catch (_) { el('share-link').select(); el('lobby-message').textContent = 'Select and copy the invite link above, then send it to your friend.'; }
    });
    window.addEventListener('pagehide', () => { if (client) client.close(); });
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'online' || params.has('room')) {
        setMode('online');
        if (params.has('room')) { el('join-code').value = params.get('room'); el('lobby-message').textContent = 'Press Join friend to enter this room.'; }
    } else render();
})();
