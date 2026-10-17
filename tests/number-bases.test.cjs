const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { highestPowers, createChallenge, remainingCapacity, placeDigit, randomTarget } = require('../number-bases.js');

test('binary choices include 16, 32 and 64; every base can represent any supported target', () => {
    for (const place of [16, 32, 64]) assert.ok(highestPowers(2).some(exponent => 2 ** exponent === place));
    for (let base = 2; base <= 10; base++) {
        for (const exponent of highestPowers(base)) {
            const state = createChallenge(base, exponent, 0);
            assert.equal(state.places.at(-1), 1);
            assert.ok(state.places[0] <= 9999);
        }
        assert.equal(createChallenge(base, highestPowers(base).at(-1), 9999).status, 'playing');
    }
});

test('every target on every offered board can be built, including zero and leading zeros', () => {
    for (let base = 2; base <= 10; base++) {
        for (const exponent of highestPowers(base)) {
            const capacity = Math.min(9999, remainingCapacity(createChallenge(base, exponent, 0)));
            for (let target = 0; target <= capacity; target++) {
                let state = createChallenge(base, exponent, target);
                // Native radix conversion is the independent oracle for the correct digits.
                const digits = target.toString(base).padStart(exponent + 1, '0').split('').map(Number);
                for (let index = 0; index < digits.length; index++) {
                    state = placeDigit(state, digits[index]);
                    assert.equal(state.status, index === digits.length - 1 ? 'success' : 'playing', `${target} in base ${base}`);
                }
                assert.equal(state.total, target);
            }
        }
    }
});

test('every incorrect digit is caught at each place across bases 2–10', () => {
    for (let base = 2; base <= 10; base++) {
        const exponent = 2;
        const capacity = base ** 3 - 1;
        for (let target = 0; target <= capacity; target++) {
            let state = createChallenge(base, exponent, target);
            const correct = target.toString(base).padStart(3, '0').split('').map(Number);
            for (const expected of correct) {
                for (let digit = 0; digit < base; digit++) {
                    if (digit === expected) continue;
                    const wrong = placeDigit(state, digit);
                    assert.equal(wrong.status, digit < expected ? 'shortfall' : 'overshoot');
                    assert.throws(() => placeDigit(wrong, 0), /Start again/);
                }
                state = placeDigit(state, expected);
            }
        }
    }
});

test('known conversions, insufficient starting places, and invalid inputs', () => {
    for (const [base, exponent, target, digits] of [[2, 4, 23, [1, 0, 1, 1, 1]], [3, 2, 17, [1, 2, 2]], [10, 2, 305, [3, 0, 5]]]) {
        const state = digits.reduce(placeDigit, createChallenge(base, exponent, target));
        assert.equal(state.status, 'success');
        assert.equal(state.total, target);
    }
    const tooSmall = createChallenge(2, 4, 32);
    assert.equal(tooSmall.status, 'too-small');
    assert.equal(remainingCapacity(tooSmall), 31);
    assert.equal(createChallenge(2, 5, 32).status, 'playing');
    for (const base of [1, 11, 2.5, NaN]) assert.throws(() => highestPowers(base), RangeError);
    for (const target of [-1, 0.5, 10000, NaN, '23']) assert.throws(() => createChallenge(2, 4, target), RangeError);
    for (const digit of [-1, 2, 1.5, NaN]) assert.throws(() => placeDigit(createChallenge(2, 4, 23), digit), RangeError);
    assert.throws(() => createChallenge(2, 0, 1), RangeError);
});

test('new targets fit all boards and never repeat the previous target', () => {
    for (let base = 2; base <= 10; base++) for (const exponent of highestPowers(base)) {
        const capacity = Math.min(9999, base ** (exponent + 1) - 1);
        for (const previous of [0, 1, Math.floor(capacity / 2), capacity, 9999]) {
            for (const roll of [0, 0.25, 0.5, 0.999999999]) {
                const target = randomTarget(base, exponent, previous, () => roll);
                assert.ok(target > 0 && target <= capacity);
                assert.notEqual(target, previous);
            }
        }
    }
});

// Minimal DOM fixture for event/render checks. It does not claim browser/layout coverage.
function loadPage() {
    class Element {
        constructor(tag = 'div') { this.tagName = tag; this.children = []; this.attributes = {}; this.listeners = {}; this.value = ''; this.className = ''; this.hidden = false; this.disabled = false; this._text = ''; }
        set textContent(value) { this._text = String(value); this.children = []; }
        get textContent() { return this._text + this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
        append(...children) { this.children.push(...children.map(child => typeof child === 'number' ? String(child) : child)); }
        appendChild(child) { this.append(child); return child; }
        replaceChildren(...children) { this._text = ''; this.children = []; this.append(...children); }
        setAttribute(key, value) { this.attributes[key] = value; }
        addEventListener(event, listener) { this.listeners[event] = listener; }
        dispatch(event) { this.listeners[event]?.({ preventDefault() {} }); }
        focus() { document.activeElement = this; }
        scrollIntoView() {}
        querySelector(selector) {
            for (const child of this.children) {
                if (typeof child === 'string') continue;
                if (selector === child.tagName || (selector.startsWith('.') && child.className.split(' ').includes(selector.slice(1)))) return child;
                const nested = child.querySelector(selector);
                if (nested) return nested;
            }
            return null;
        }
    }
    const html = fs.readFileSync(path.join(__dirname, '../number-bases.html'), 'utf8');
    const elements = {};
    for (const match of html.matchAll(/<([a-z-]+)[^>]*\bid="([^"]+)"/g)) elements[match[2]] = new Element(match[1]);
    const document = { getElementById: id => elements[id] || null, createElement: tag => new Element(tag), activeElement: null };
    elements.base.value = '2';
    const context = vm.createContext({ document, Math });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../number-bases.js'), 'utf8'), context);
    const clickDigit = digit => {
        const button = elements.digits.children.find(child => child.textContent === String(digit));
        assert.ok(button, `digit ${digit} should be available`);
        button.dispatch('click');
    };
    return { elements, document, clickDigit };
}

test('page flow: binary shortfall, restart, overshoot, success, and new number', () => {
    const { elements: el, document, clickDigit } = loadPage();
    assert.equal(el.target.textContent, '23');
    assert.equal(el.places.children.length, 5);
    assert.equal(el.digits.children.length, 2);
    clickDigit(0);
    assert.match(el['feedback-text'].textContent, /still need 23.*only 15/);
    assert.equal(el.decision.hidden, true);
    assert.equal(document.activeElement, el.restart);
    el.restart.dispatch('click');
    assert.equal(el.target.textContent, '23');
    clickDigit(1);
    clickDigit(1);
    assert.match(el['feedback-text'].textContent, /Too much/);
    el.restart.dispatch('click');
    for (const digit of [1, 0, 1, 1, 1]) clickDigit(digit);
    assert.match(el['feedback-text'].textContent, /You built it/);
    assert.equal(el.built.textContent, '23');
    assert.match(el.equation.textContent, /1 × 16 \+ 0 × 8 \+ 1 × 4 \+ 1 × 2 \+ 1 × 1 = 23/);
    assert.equal(document.activeElement, el['new-number']);
    el['new-number'].dispatch('click');
    assert.notEqual(el.target.textContent, '23');
    assert.equal(el.digits.children.length, 2);
});

test('page flow: smaller board, custom zero and base-three conversion', () => {
    const { elements: el, clickDigit } = loadPage();
    el.highest.value = '3';
    el.highest.dispatch('change');
    assert.match(el['feedback-text'].textContent, /at most 15/);
    assert.equal(el.restart.disabled, true);
    el.highest.value = '5';
    el.highest.dispatch('change');
    assert.equal(el.digits.children.length, 2);
    el['target-input'].value = '0';
    el['target-form'].dispatch('submit');
    for (let index = 0; index < 6; index++) clickDigit(0);
    assert.match(el['feedback-text'].textContent, /You built it! 0/);
    el.base.value = '3';
    el.base.dispatch('change');
    assert.equal(el.target.textContent, '0');
    assert.equal(el.digits.children.length, 3);
    assert.match(el['base-explanation'].textContent, /digits 0 to 2/);
    el['target-input'].value = '17';
    el['target-form'].dispatch('submit');
    for (const digit of [1, 2, 2]) clickDigit(digit);
    assert.match(el['feedback-text'].textContent, /17 in base 10 is 122 in base 3/);
    el['target-input'].value = '1.5';
    el['target-form'].dispatch('submit');
    assert.equal(el.target.textContent, '17');
    el['target-input'].value = '9999';
    el['target-form'].dispatch('submit');
    el.base.value = '2';
    el.base.dispatch('change');
    assert.equal(el.target.textContent, '9999');
    assert.equal(el.highest.value, '13');
    assert.equal(el.decision.hidden, false);
});
