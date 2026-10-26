(function (root) {
    'use strict';
    const rules = typeof module !== 'undefined' && module.exports ? require('./power-grid-rules.js') : root.PowerGrid;
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    function randomCode() {
        return [...root.crypto.getRandomValues(new Uint8Array(6))].map(value => alphabet[value % alphabet.length]).join('');
    }
    function normalizeCode(value) {
        const code = String(value).trim().toUpperCase();
        if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new Error('Enter the six-letter/number Power Grid code.');
        return code;
    }
    // Firebase is loaded only when online play is requested. Local play works offline.
    let firebasePromise;
    async function loadFirebase() {
        if (!firebasePromise) firebasePromise = Promise.all([
            import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js')
        ]).then(([appSDK, sdk]) => {
            // Same public web configuration as Carronade_Multiplayer.html.
            const app = appSDK.initializeApp({
                apiKey: 'AIzaSyAdQTK8tSHhnla5LePBKb0EgGHUWchkNbQ',
                authDomain: 'math-bdf5e.firebaseapp.com',
                databaseURL: 'https://math-bdf5e-default-rtdb.asia-southeast1.firebasedatabase.app',
                projectId: 'math-bdf5e',
                appId: '1:515958917799:web:5e85a5dfabbce1e5a62982'
            }, 'power-grid');
            return { sdk, db: sdk.getDatabase(app) };
        }).catch(error => { firebasePromise = null; throw error; });
        return firebasePromise;
    }
    function waitForConnection(sdk, db) {
        return new Promise((resolve, reject) => {
            let off = () => {};
            const timer = setTimeout(() => { off(); reject(new Error('Could not connect to Firebase. Check your internet and try again.')); }, 12000);
            off = sdk.onValue(sdk.ref(db, '.info/connected'), snap => {
                if (snap.val() === true) { clearTimeout(timer); queueMicrotask(() => off()); resolve(); }
            }, error => { clearTimeout(timer); reject(error); });
        });
    }
    function withDeadline(promise) {
        let timer;
        return Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('No confirmation yet. Check your connection; rejoin this room to see whether the action was saved.')), 15000);
        })]).finally(() => clearTimeout(timer));
    }
    function createClient({ sdk, db, storage, onRoom, onConnection, onError, makeCode = randomCode, makeId = () => root.crypto.randomUUID() }) {
        let code, id, roomRef, presenceRef, disconnect, connected = false, closed = false;
        const subscriptions = [];
        const identities = new Map();
        function identity(roomCode) {
            const key = 'power-grid-seat-' + roomCode;
            let stored;
            try { stored = storage?.getItem(key); } catch (_) { /* Session storage may be unavailable. */ }
            const value = stored || identities.get(key) || makeId();
            identities.set(key, value);
            try { storage?.setItem(key, value); } catch (_) { /* Keep this tab playable. */ }
            return value;
        }
        async function transact(target, update) {
            let reason;
            const result = await withDeadline(sdk.runTransaction(target, current => {
                reason = null;
                try { return update(current); } catch (error) { reason = error; return undefined; }
            }, { applyLocally: false }));
            if (!result.committed) throw reason || new Error('The room changed. Please try again.');
            if (!result.snapshot.val()) throw new Error('Power Grid room not found. Check the code.');
            return result.snapshot.val();
        }
        function attach(roomCode, token) {
            if (closed) return;
            code = roomCode; id = token;
            roomRef = sdk.ref(db, 'rooms/power-grid-' + code);
            presenceRef = sdk.ref(db, 'rooms/power-grid-' + code + '/presence/' + id);
            subscriptions.push(sdk.onValue(roomRef, snap => {
                const room = snap.val();
                if (room) onRoom(room, rules.roleFor(room, id), code);
                else onError(new Error('This room is no longer available. Create a new room.'));
            }, onError));
            subscriptions.push(sdk.onValue(sdk.ref(db, '.info/connected'), snap => {
                connected = snap.val() === true;
                onConnection(connected);
                if (connected) {
                    const ownDisconnect = sdk.onDisconnect(presenceRef);
                    disconnect = ownDisconnect;
                    ownDisconnect.set(false).then(() => {
                        if (!closed && connected) return sdk.set(presenceRef, true);
                        return ownDisconnect.cancel();
                    }).catch(onError);
                }
            }, onError));
        }
        return {
            async create(rows, cols) {
                for (let attempt = 0; attempt < 5; attempt++) {
                    const newCode = normalizeCode(makeCode()), token = identity(newCode);
                    const target = sdk.ref(db, 'rooms/power-grid-' + newCode);
                    const initial = rules.createRoom(rows, cols, token);
                    const result = await withDeadline(sdk.runTransaction(target, current => current === null ? initial : undefined, { applyLocally: false }));
                    if (result.committed) { attach(newCode, token); return newCode; }
                }
                throw new Error('Could not reserve a room code. Please try again.');
            },
            async join(value) {
                const newCode = normalizeCode(value), token = identity(newCode);
                const target = sdk.ref(db, 'rooms/power-grid-' + newCode);
                // Prime the local cache before a transaction; callbacks can also start at null.
                const snap = await withDeadline(sdk.get(target));
                if (!snap.exists()) throw new Error('Power Grid room not found. Check the code.');
                await transact(target, current => current === null ? null : rules.joinRoom(current, token));
                attach(newCode, token);
                return newCode;
            },
            async move(rect, round, revision) {
                if (!connected || closed) throw new Error('Reconnecting… wait until you are online.');
                return transact(roomRef, current => current === null ? null : rules.moveInRoom(current, id, rect, round, revision));
            },
            async rematch(round) {
                if (!connected || closed) throw new Error('Reconnecting… wait until you are online.');
                return transact(roomRef, current => current === null ? null : rules.requestRematch(current, id, round));
            },
            close() {
                closed = true; connected = false;
                subscriptions.forEach(off => off());
                // Keep the disconnect hook until the explicit offline write succeeds.
                if (presenceRef) sdk.set(presenceRef, false).then(() => disconnect?.cancel()).catch(() => {});
            }
        };
    }
    const api = { normalizeCode, loadFirebase, waitForConnection, createClient };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.PowerGridOnline = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
