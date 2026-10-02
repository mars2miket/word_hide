// --- GLOBAL EXAM MODULE CONTEXT ENGINE ---
let activeExamRows = [];
let isQuestionActive = false; // Prevents header toggles from changing the question
let examMode = 'type';        // 'type' | 'choice' | 'tf' | 'select'
let examReverse = false;      // false = A is prompt, true = B is prompt
let examDeck = [];            // Shuffled rows still waiting to be asked
let lastExamItem = null;      // Prevents back-to-back repeats across reshuffles
let examSignature = '';       // Detects when spreadsheet data actually changed
let currentItem = null;       // The question currently on screen (if any)

const EXAM_MODES = [
    { id: 'type',   label: 'Typing' },
    { id: 'choice', label: 'Multi Choice' },
    { id: 'tf',     label: 'T / F' },
    { id: 'select', label: 'Select All' }
];

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// -------------------------------------------------------------------------
// SHELL + QUESTION RENDERING
// The recall viewer always contains a .exam-question-wrapper in list mode.
// The shell (mode bar + labels + input + buttons) is always present; it is
// either in a DISABLED (no data) state or an ACTIVE (question loaded) state.
// -------------------------------------------------------------------------

function buildShell() {
    const wrapper = document.createElement('div');
    wrapper.className = 'exam-question-wrapper';

    // Mode switcher bar
    const modeBar = document.createElement('div');
    modeBar.className = 'exam-mode-row';
    EXAM_MODES.forEach(m => {
        const b = document.createElement('button');
        b.className = 'exam-mode-btn' + (m.id === examMode ? ' active' : '');
        b.dataset.mode = m.id;
        b.textContent = m.label;
        b.addEventListener('click', () => {
            examMode = m.id;
            if (currentItem) {
                drawActiveQuestion(currentItem);
            } else {
                renderShell();
            }
        });
        modeBar.appendChild(b);
    });

    const dirBtn = document.createElement('button');
    dirBtn.className = 'exam-mode-btn';
    dirBtn.id = 'exam-dir-btn';
    dirBtn.style.flex = '0 0 auto';
    dirBtn.textContent = examReverse ? 'B → A' : 'A → B';
    dirBtn.addEventListener('click', () => {
        examReverse = !examReverse;
        isQuestionActive = false;
        currentItem = null;
        examSignature = '';
        generateMockTest();
    });
    modeBar.appendChild(dirBtn);
    wrapper.appendChild(modeBar);

    // Prompt line
    const promptP = document.createElement('p');
    promptP.id = 'exam-prompt-line';
    promptP.innerHTML = `<strong>Exam Prompt:</strong> <span id="exam-prompt-text"></span>`;
    wrapper.appendChild(promptP);

    // Body (mode-specific content goes here)
    const body = document.createElement('div');
    body.id = 'exam-body';
    body.className = 'exam-body';
    wrapper.appendChild(body);

    // Action row
    const actions = document.createElement('div');
    actions.className = 'exam-actions-row';
    actions.style.cssText = 'display: flex; gap: 8px;';

    const checkBtn = document.createElement('button');
    checkBtn.id = 'exam-submit-btn';
    checkBtn.className = 'primary-btn';
    checkBtn.style.flex = '1';
    checkBtn.textContent = 'Check Answer';
    actions.appendChild(checkBtn);

    const nextBtn = document.createElement('button');
    nextBtn.id = 'exam-next-btn';
    nextBtn.className = 'primary-btn';
    nextBtn.style.flex = '1';
    nextBtn.textContent = 'Next ➡️';
    actions.appendChild(nextBtn);
    wrapper.appendChild(actions);

    // Feedback
    const feedback = document.createElement('p');
    feedback.id = 'exam-feedback';
    feedback.style.cssText = 'margin-top: 12px; font-weight: bold; min-height: 20px;';
    wrapper.appendChild(feedback);

    return wrapper;
}

function getShell() {
    return recallViewer.querySelector('.exam-question-wrapper');
}

// Renders the disabled / no-data shell (matches the screenshot).
function renderShell() {
    let wrapper = getShell();
    if (!wrapper) {
        wrapper = buildShell();
        recallViewer.appendChild(wrapper);
    }

    // Sync mode bar active state + direction label
    wrapper.querySelectorAll('.exam-mode-btn[data-mode]').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === examMode);
    });
    const dirBtn = wrapper.querySelector('#exam-dir-btn');
    if (dirBtn) dirBtn.textContent = examReverse ? 'B → A' : 'A → B';

    // Blank prompt
    const promptText = wrapper.querySelector('#exam-prompt-text');
    if (promptText) promptText.textContent = '';

    // Disabled body with placeholder answer UI
    const body = wrapper.querySelector('#exam-body');
    if (body) {
        body.className = 'exam-body mode-' + examMode;
        body.innerHTML = '';

        if (examMode === 'type') {
            const p = document.createElement('p');
            p.innerHTML = `<strong>Your Answer:</strong> <input type="text" id="exam-user-input" autocomplete="off" style="margin-bottom: 8px; width: 100%; box-sizing: border-box; padding: 8px;" disabled>`;
            body.appendChild(p);
        } else if (examMode === 'choice') {
            for (let i = 0; i < 3; i++) {
                const b = document.createElement('button');
                b.className = 'exam-choice';
                b.disabled = true;
                b.textContent = '\u00A0';
                body.appendChild(b);
            }
        } else if (examMode === 'tf') {
            const p = document.createElement('p');
            p.innerHTML = `<strong>Proposed Answer:</strong> <span></span>`;
            body.appendChild(p);
            ['True', 'False'].forEach(t => {
                const b = document.createElement('button');
                b.className = 'exam-choice';
                b.disabled = true;
                b.textContent = t;
                body.appendChild(b);
            });
        } else if (examMode === 'select') {
            for (let i = 0; i < 3; i++) {
                const lbl = document.createElement('label');
                lbl.className = 'exam-check';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.disabled = true;
                const span = document.createElement('span');
                span.innerHTML = '&nbsp;';
                lbl.appendChild(cb);
                lbl.appendChild(span);
                body.appendChild(lbl);
            }
        }
    }

    // Disable buttons
    const checkBtn = wrapper.querySelector('#exam-submit-btn');
    const nextBtn = wrapper.querySelector('#exam-next-btn');
    if (checkBtn) checkBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;

    // Clear feedback
    const feedback = wrapper.querySelector('#exam-feedback');
    if (feedback) feedback.textContent = '';

    isQuestionActive = false;
    currentItem = null;
}

// -------------------------------------------------------------------------
// DATA EXTRACTION + DECK MANAGEMENT
// -------------------------------------------------------------------------

function resetExam() {
    activeExamRows = [];
    examDeck = [];
    examSignature = '';
    lastExamItem = null;
    isQuestionActive = false;
    currentItem = null;
    renderShell();
}

function generateMockTest() {
    // 1. Extract all valid completed rows from the spreadsheet grid matrix
    activeExamRows = [];
    spreadsheetContainer.querySelectorAll('.data-cell[data-col="A"]').forEach(cellA => {
        const rowNum = cellA.dataset.row;
        const cellB = spreadsheetContainer.querySelector(`.data-cell[data-row="${rowNum}"][data-col="B"]`);
        if (cellA.textContent.trim() && cellB && cellB.textContent.trim()) {
            const valA = cellA.textContent.trim();
            const valB = cellB.textContent.trim();
            activeExamRows.push(examReverse
                ? { prompt: valB, answer: valA }
                : { prompt: valA, answer: valB });
        }
    });

    // 2. No data → show disabled shell, nothing else to do
    if (activeExamRows.length === 0) {
        examSignature = '';
        examDeck = [];
        isQuestionActive = false;
        currentItem = null;
        renderShell();
        return;
    }

    // 3. Rebuild the deck only if the data changed
    const newSignature = JSON.stringify(activeExamRows);
    if (newSignature !== examSignature) {
        examSignature = newSignature;
        examDeck = [];
    }

    // 4. Draw a fresh question and render it into the shell
    const item = drawNextItem();
    drawActiveQuestion(item);
}

function drawNextItem() {
    if (examDeck.length === 0) {
        examDeck = shuffle(activeExamRows);
        const top = examDeck[examDeck.length - 1];
        if (examDeck.length > 1 && lastExamItem &&
            top.prompt === lastExamItem.prompt && top.answer === lastExamItem.answer) {
            [examDeck[0], examDeck[examDeck.length - 1]] = [examDeck[examDeck.length - 1], examDeck[0]];
        }
    }
    lastExamItem = examDeck.pop();
    return lastExamItem;
}

// -------------------------------------------------------------------------
// ACTIVE QUESTION RENDERING (fills the shell with a live question)
// -------------------------------------------------------------------------

function showFeedback(el, correct, expected) {
    if (correct) {
        el.textContent = "✅ Correct! Great job.";
        el.style.color = "green";
    } else {
        el.textContent = `❌ Incorrect. Expected: "${expected}"`;
        el.style.color = "red";
    }
}

function drawActiveQuestion(item) {
    currentItem = item;
    isQuestionActive = true;

    let wrapper = getShell();
    if (!wrapper) {
        wrapper = buildShell();
        recallViewer.appendChild(wrapper);
    }

    // Sync mode bar active state + direction label
    wrapper.querySelectorAll('.exam-mode-btn[data-mode]').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === examMode);
    });
    const dirBtn = wrapper.querySelector('#exam-dir-btn');
    if (dirBtn) dirBtn.textContent = examReverse ? 'B → A' : 'A → B';

    // Fill prompt
    const promptText = wrapper.querySelector('#exam-prompt-text');
    if (promptText) promptText.innerHTML = esc(item.prompt);

    // Reset body
    const body = wrapper.querySelector('#exam-body');
    body.className = 'exam-body mode-' + examMode;
    body.innerHTML = '';

    // Reset feedback
    const feedback = wrapper.querySelector('#exam-feedback');
    feedback.textContent = '';
    feedback.style.color = '';

    const checkBtn = wrapper.querySelector('#exam-submit-btn');
    const nextBtn = wrapper.querySelector('#exam-next-btn');

    // Enable Next for all modes; Check only for type/select
    nextBtn.disabled = false;
    checkBtn.disabled = (examMode !== 'type' && examMode !== 'select');

    // Build the current mode's body
    if (examMode === 'choice') buildChoiceQuestion(item, body, feedback);
    else if (examMode === 'tf') buildTFQuestion(item, body, feedback);
    else if (examMode === 'select') buildSelectQuestion(item, body, feedback, checkBtn);
    else buildTypeQuestion(item, body, feedback, checkBtn);

    // Next button handler — draw a new question into the same shell
    // (replace handler each time to avoid stacking)
    const newNext = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNext, nextBtn);
    newNext.addEventListener('click', () => {
        if (activeExamRows.length === 0) {
            renderShell();
            return;
        }
        const next = drawNextItem();
        drawActiveQuestion(next);
    });
}

// --- QUESTION BUILDERS (one per mode) ---

function buildTypeQuestion(item, body, feedback, checkBtn) {
    body.innerHTML = `
        <p><strong>Your Answer:</strong> <input type="text" id="exam-user-input" autocomplete="off" style="margin-bottom: 8px; width: 100%; box-sizing: border-box; padding: 8px;"></p>
    `;
    const input = body.querySelector('#exam-user-input');
    input.focus();

    // Replace check button to clear any old handler
    const newCheck = checkBtn.cloneNode(true);
    newCheck.disabled = false;
    checkBtn.parentNode.replaceChild(newCheck, checkBtn);

    newCheck.addEventListener('click', () => {
        const correct = input.value.trim().toLowerCase() === item.answer.toLowerCase();
        showFeedback(feedback, correct, item.answer);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            newCheck.click();
        }
    });
}

function buildChoiceQuestion(item, body, feedback) {
    const wrong = shuffle([...new Set(activeExamRows.map(r => r.answer))]
        .filter(a => a.toLowerCase() !== item.answer.toLowerCase())).slice(0, 3);
    const options = shuffle([item.answer, ...wrong]);

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'exam-choice';
        btn.textContent = opt;
        btn.addEventListener('click', () => {
            const correct = opt === item.answer;
            body.querySelectorAll('.exam-choice').forEach(b => {
                b.disabled = true;
                if (b.textContent === item.answer) b.classList.add('correct');
            });
            if (!correct) btn.classList.add('wrong');
            showFeedback(feedback, correct, item.answer);
        });
        body.appendChild(btn);
    });
}

function buildTFQuestion(item, body, feedback) {
    const wrongPool = [...new Set(activeExamRows.map(r => r.answer))]
        .filter(a => a.toLowerCase() !== item.answer.toLowerCase());
    const isTrue = wrongPool.length === 0 || Math.random() < 0.5;
    const shown = isTrue ? item.answer : wrongPool[Math.floor(Math.random() * wrongPool.length)];

    const statement = document.createElement('p');
    statement.innerHTML = `<strong>Proposed Answer:</strong> ${esc(shown)}`;
    body.appendChild(statement);

    [true, false].forEach(val => {
        const btn = document.createElement('button');
        btn.className = 'exam-choice';
        btn.textContent = val ? 'True' : 'False';
        btn.addEventListener('click', () => {
            const correct = val === isTrue;
            body.querySelectorAll('.exam-choice').forEach(b => {
                b.disabled = true;
                if ((b.textContent === 'True') === isTrue) b.classList.add('correct');
            });
            if (!correct) btn.classList.add('wrong');
            showFeedback(feedback, correct, isTrue ? 'True' : `False (correct: "${item.answer}")`);
        });
        body.appendChild(btn);
    });
}

function buildSelectQuestion(item, body, feedback, checkBtn) {
    const key = item.prompt.toLowerCase();
    const correctSet = [...new Set(activeExamRows
        .filter(r => r.prompt.toLowerCase() === key)
        .map(r => r.answer))];
    const correctLower = correctSet.map(a => a.toLowerCase());

    const wrong = shuffle([...new Set(activeExamRows.map(r => r.answer))]
        .filter(a => !correctLower.includes(a.toLowerCase())))
        .slice(0, Math.max(2, 4 - correctSet.length));
    const options = shuffle([...correctSet, ...wrong]);

    const hint = document.createElement('p');
    hint.style.cssText = 'color:#64748b; font-size:13px; margin:0 0 6px 0;';
    hint.textContent = 'Select all that apply:';
    body.appendChild(hint);

    options.forEach(opt => {
        const label = document.createElement('label');
        label.className = 'exam-check';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = opt;
        const span = document.createElement('span');
        span.textContent = opt;
        label.appendChild(cb);
        label.appendChild(span);
        body.appendChild(label);
    });

    const newCheck = checkBtn.cloneNode(true);
    newCheck.disabled = false;
    checkBtn.parentNode.replaceChild(newCheck, checkBtn);

    newCheck.addEventListener('click', () => {
        const boxes = [...body.querySelectorAll('input[type="checkbox"]')];
        let allRight = true;
        boxes.forEach(cb => {
            const shouldBe = correctLower.includes(cb.value.toLowerCase());
            if (cb.checked !== shouldBe) allRight = false;
            const lbl = cb.parentElement;
            if (shouldBe) lbl.classList.add('correct');
            else if (cb.checked) lbl.classList.add('wrong');
            cb.disabled = true;
        });
        newCheck.disabled = true;
        showFeedback(feedback, allRight, correctSet.join(', '));
    });
}

// --- SIDEBAR RESET ON WINDOW RESIZE ---
window.addEventListener('resize', () => {
    if (window.innerWidth > 700) {
        const toggleInput = document.querySelector('.sidebar-toggle-input');
        if (toggleInput) {
            toggleInput.checked = false;
        }
    }
});

// --- INITIAL RENDER ---
// Draw the disabled shell immediately so the viewer is never empty in list mode.
(function initExamShell() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!window.noteActive) renderShell();
        });
    } else {
        if (!window.noteActive) renderShell();
    }
})();