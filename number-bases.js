/* Pure place-value rules shared by the page and the Node regression tests. */
(function (root) {
    'use strict';

    const MAX_TARGET = 9999;
    function highestPowers(base) {
        if (!Number.isInteger(base) || base < 2 || base > 10) throw new RangeError('Choose a base from 2 to 10.');
        const powers = [];
        for (let exponent = 1; base ** exponent <= MAX_TARGET; exponent++) {
            powers.push(exponent);
        }
        return powers;
    }

    function createChallenge(base, exponent, target) {
        if (!highestPowers(base).includes(exponent)) throw new RangeError('Choose an available highest place.');
        if (!Number.isInteger(target) || target < 0 || target > MAX_TARGET) throw new RangeError('Choose a whole number from 0 to 9999.');
        const places = Array.from({ length: exponent + 1 }, (_, index) => base ** (exponent - index));
        const capacity = base ** (exponent + 1) - 1;
        return { base, exponent, target, places, digits: [], total: 0,
            status: target > capacity ? 'too-small' : 'playing' };
    }

    function remainingCapacity(state) {
        return state.places.slice(state.digits.length).reduce((sum, place) => sum + (state.base - 1) * place, 0);
    }

    function placeDigit(state, digit) {
        if (state.status !== 'playing') throw new Error('Start again or choose a new number.');
        if (!Number.isInteger(digit) || digit < 0 || digit >= state.base) throw new RangeError('That digit is not available in this base.');
        const next = { ...state, digits: [...state.digits, digit], total: state.total + digit * state.places[state.digits.length] };
        const remainder = next.target - next.total;
        if (remainder < 0) next.status = 'overshoot';
        else if (remainder > remainingCapacity(next)) next.status = 'shortfall';
        else if (next.digits.length === next.places.length) next.status = 'success';
        return next;
    }

    function randomTarget(base, exponent, previous, random = Math.random) {
        const capacity = Math.min(MAX_TARGET, base ** (exponent + 1) - 1);
        // Sample every representable non-zero target, excluding the previous one.
        const excludePrevious = Number.isInteger(previous) && previous >= 1 && previous <= capacity;
        let target = 1 + Math.floor(random() * (capacity - (excludePrevious ? 1 : 0)));
        if (excludePrevious && target >= previous) target++;
        return target;
    }

    const rules = { MAX_TARGET, highestPowers, createChallenge, remainingCapacity, placeDigit, randomTarget };
    if (typeof module !== 'undefined' && module.exports) module.exports = rules;
    if (!root.document) return;

    const document = root.document;
    const element = id => document.getElementById(id);
    const baseSelect = element('base');
    const highestSelect = element('highest');
    const input = element('target-input');
    let state;

    function configurePlaces(base) {
        highestSelect.replaceChildren();
        highestPowers(base).forEach(exponent => {
            const option = document.createElement('option');
            option.value = exponent;
            option.textContent = `${base ** exponent} (${base}^${exponent})`;
            highestSelect.appendChild(option);
        });
        const preferred = base === 2 ? 4 : 2;
        // Keep the decimal target when switching bases so students can compare it.
        const exponent = highestPowers(base).find(power => power >= preferred && (!state || base ** (power + 1) > state.target));
        highestSelect.value = String(exponent);
    }

    function start(target, focus = false) {
        state = createChallenge(Number(baseSelect.value), Number(highestSelect.value), target);
        input.value = target;
        render();
        if (focus && state.status === 'playing') focusDigit();
    }

    function focusDigit() {
        const button = element('digits').querySelector('button');
        if (button) button.focus({ preventScroll: true });
        const active = element('places').querySelector('.active');
        if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }

    function chooseDigit(digit) {
        state = placeDigit(state, digit);
        render();
        if (state.status === 'playing') focusDigit();
        else element(state.status === 'success' ? 'new-number' : 'restart').focus({ preventScroll: true });
    }

    function renderPlaces() {
        const container = element('places');
        container.replaceChildren();
        state.places.forEach((place, index) => {
            const filled = index < state.digits.length;
            const active = state.status === 'playing' && index === state.digits.length;
            const wrong = ['overshoot', 'shortfall'].includes(state.status) && index === state.digits.length - 1;
            const card = document.createElement('div');
            card.className = `place${filled ? ' filled' : ''}${active ? ' active' : ''}${wrong ? ' wrong' : ''}`;
            if (active) card.setAttribute('aria-current', 'step');
            const label = document.createElement('span');
            label.className = 'place-label';
            label.textContent = wrong ? 'Try again' : active ? 'Choose here ↓' : filled ? 'Placed ✓' : 'Waiting';
            card.appendChild(label);
            const power = document.createElement('p');
            power.className = 'power';
            power.append(`${state.base}`);
            const sup = document.createElement('sup');
            sup.textContent = state.exponent - index;
            power.appendChild(sup);
            card.appendChild(power);
            const weight = document.createElement('div');
            weight.className = 'weight';
            weight.textContent = place;
            card.appendChild(weight);
            const digit = document.createElement('span');
            digit.className = 'digit';
            digit.textContent = filled ? state.digits[index] : '?';
            digit.setAttribute('aria-label', `${place} place: ${filled ? state.digits[index] : 'empty'}`);
            card.appendChild(digit);
            const groups = document.createElement('div');
            groups.className = 'groups';
            groups.setAttribute('aria-hidden', 'true');
            for (let count = 0; filled && count < state.digits[index]; count++) {
                const dot = document.createElement('span');
                dot.className = 'group-dot';
                groups.appendChild(dot);
            }
            card.appendChild(groups);
            const contribution = document.createElement('div');
            contribution.className = 'contribution';
            contribution.textContent = filled ? `${state.digits[index]} × ${place} = ${state.digits[index] * place}` : `? × ${place}`;
            card.appendChild(contribution);
            container.appendChild(card);
        });
    }

    function render() {
        const playing = state.status === 'playing';
        const failed = ['too-small', 'shortfall', 'overshoot'].includes(state.status);
        const remainder = state.target - state.total;
        const capacity = remainingCapacity(state);
        element('target').textContent = state.target;
        element('base-tag').textContent = `using base ${state.base}${state.base === 2 ? ' · Binary' : ''}`;
        element('built').textContent = state.total;
        element('remaining').textContent = Math.abs(remainder);
        element('remaining-label').textContent = remainder < 0 ? 'Too much' : 'Still needed';
        element('total-meter').max = Math.max(1, state.target);
        element('total-meter').value = Math.min(state.total, state.target);
        element('meter-text').textContent = `${state.total} of ${state.target}`;
        renderPlaces();

        element('decision').hidden = !playing;
        element('decision-title').textContent = playing ? `Which digit belongs in the ${state.places[state.digits.length]} place?` : 'Attempt finished';
        element('decision-help').textContent = `You can use ${state.base === 2 ? '0 or 1' : `digits 0 to ${state.base - 1}`} in base ${state.base}. Each digit counts groups of this place value.`;
        const choices = element('digits');
        choices.replaceChildren();
        if (playing) for (let digit = 0; digit < state.base; digit++) {
            const button = document.createElement('button');
            button.className = 'digit-choice';
            button.textContent = digit;
            button.setAttribute('aria-label', `Put ${digit} in the ${state.places[state.digits.length]} place`);
            button.addEventListener('click', () => chooseDigit(digit));
            choices.appendChild(button);
        }

        const emptyPlaces = state.places.length - state.digits.length;
        element('capacity').textContent = emptyPlaces
            ? `${emptyPlaces} empty ${emptyPlaces === 1 ? 'place' : 'places'} can still add 0 to ${capacity} (at most ${state.base - 1} in each box).`
            : 'No empty places remain. Your digit boxes are full.';
        element('capacity').className = `capacity${failed ? ' fail' : ''}`;

        let message;
        if (state.status === 'too-small') message = `Not enough places! These boxes can hold at most ${capacity}, but your target is ${state.target}. Choose a higher place value above, or try a smaller number.`;
        else if (state.status === 'overshoot') message = `Too much! Your last digit made ${state.total}, which is ${-remainder} above ${state.target}. The places on the right can only add more. Start again and try a smaller digit.`;
        else if (state.status === 'shortfall') message = `Not enough room! You still need ${remainder}, but the empty places can add only ${capacity}. Even putting ${state.base - 1} in every empty box will not reach ${state.target}. Start again and try a larger digit.`;
        else if (state.status === 'success') message = `You built it! ${state.target} in base 10 is ${state.digits.join('')} in base ${state.base}. Read your digits from left to right.`;
        else if (!state.digits.length) message = `Start with the ${state.places[0]} place. Can you use some groups of ${state.places[0]} without passing ${state.target}?`;
        else if (remainder === 0) message = `You have made ${state.target}! Fill every remaining place with 0 to keep the same value.`;
        else message = `Good fit! ${state.total} built, ${remainder} still needed. Now choose the digit for the ${state.places[state.digits.length]} place.`;
        element('feedback').className = `feedback${failed ? ' fail' : state.status === 'success' ? ' success' : ''}`;
        element('feedback-text').textContent = message;

        element('restart').textContent = failed ? '↻ Try this number again' : '↻ Start again';
        // The same settings cannot fix a too-small board; keep attention on the selector.
        element('restart').disabled = state.status === 'too-small';
        const equation = element('equation');
        equation.hidden = !state.digits.length;
        equation.replaceChildren();
        if (state.digits.length) {
            const heading = document.createElement('strong');
            if (state.status === 'success') {
                heading.append(state.digits.join(''));
                const baseSubscript = document.createElement('sub');
                baseSubscript.textContent = state.base;
                heading.append(baseSubscript, ` = ${state.target}`);
                const decimalSubscript = document.createElement('sub');
                decimalSubscript.textContent = '10';
                heading.appendChild(decimalSubscript);
            } else heading.textContent = 'Your building so far';
            equation.append(heading, state.digits.map((digit, index) => `${digit} × ${state.places[index]}`).join(' + ') + ` = ${state.total}`);
        }
        renderLesson();
    }

    function renderLesson() {
        element('base-explanation').textContent = state.base === 2
            ? 'Binary is base 2. It has only two digits: 0 and 1. Its places are 1, 2, 4, 8, 16, 32, 64, …'
            : `Base ${state.base} uses digits 0 to ${state.base - 1}. Its places are 1, ${state.base}, ${state.base ** 2}, ${state.base ** 3}, …`;
        element('place-multiplier').textContent = `${state.base} times`;
        const exampleTarget = state.base === 2 ? 13 : 2 * state.base + 1;
        const exampleDigits = exampleTarget.toString(state.base);
        const example = element('example');
        example.replaceChildren(`${exampleTarget} in base 10 = ${exampleDigits}`);
        const base = document.createElement('sub');
        base.textContent = state.base;
        example.appendChild(base);
        const expansion = document.createElement('p');
        expansion.textContent = exampleDigits.split('').map((digit, index) => `${digit} × ${state.base ** (exampleDigits.length - index - 1)}`).join(' + ') + ` = ${exampleTarget}`;
        example.appendChild(expansion);
    }

    baseSelect.addEventListener('change', () => {
        const base = Number(baseSelect.value);
        configurePlaces(base);
        start(state.target);
    });
    highestSelect.addEventListener('change', () => start(state.target));
    element('target-form').addEventListener('submit', event => {
        event.preventDefault();
        if (!/^[0-9]{1,4}$/.test(input.value)) return;
        start(Number(input.value), true);
    });
    element('restart').addEventListener('click', () => start(state.target, true));
    element('new-number').addEventListener('click', () => start(randomTarget(state.base, state.exponent, state.target), true));
    configurePlaces(2);
    start(23);
})(typeof globalThis !== 'undefined' ? globalThis : this);
