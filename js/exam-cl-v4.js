// --- GLOBAL EXAM MODULE CONTEXT ENGINE ---
let activeExamRows = [];
let isQuestionActive = false; // Prevents header toggles from changing the question
let examMode = 'type';        // 'type' | 'choice' | 'tf' | 'select'
let examReverse = false;      // false = A is prompt, true = B is prompt
let examDeck = [];            // Shuffled rows still waiting to be asked
let lastExamItem = null;      // Prevents back-to-back repeats across reshuffles
let examSignature = '';       // Detects when spreadsheet data actually changed

const EXAM_MODES = [
    { id: 'type',   label: 'Typing' },
    { id: 'choice', label: 'Multiple Choice' },
    { id: 'tf',     label: 'True / False' },
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

// Clears all exam state (used when switching lists)
function resetExam() {
    activeExamRows = [];
    examDeck = [];
    examSignature = '';
    lastExamItem = null;
    isQuestionActive = false;
    const w = recallViewer.querySelector('.exam-question-wrapper');
    if (w) w.remove();
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

    // Rebuild the deck only if the data changed (header clicks won't reshuffle)
    const newSignature = JSON.stringify(activeExamRows);
    if (newSignature !== examSignature) {
        examSignature = newSignature;
        examDeck = [];
    }

    // 2. Prevent crash if there is no data inside the grid columns
    if (activeExamRows.length === 0) {
        isQuestionActive = false;
        return;
    }

    // 3. If a question is already active on screen, STOP here.
    if (isQuestionActive) {
        return;
    }

    // 4. Initialize the loop engine sequence if no question is active
    serveQuestion();
}

function showFeedback(el, correct, expected) {
    if (correct) {
        el.textContent = "✅ Correct! Great job.";
        el.style.color = "green";
    } else {
        el.textContent = `❌ Incorrect. Expected: "${expected}"`;
        el.style.color = "red";
    }
}

// --- QUESTION BUILDERS (one per mode) ---
// Typing and Select All receive a checkBtn that lives in the bottom action row.
function buildTypeQuestion(item, body, feedback, checkBtn) {
    body.innerHTML = `
        <p><strong>Your Answer:</strong> <input type="text" id="exam-user-input" autocomplete="off" style="margin-bottom: 8px; width: 100%; box-sizing: border-box; padding: 8px;"></p>
    `;
    const input = body.querySelector('#exam-user-input');
    input.focus();

    checkBtn.addEventListener('click', () => {
        const correct = input.value.trim().toLowerCase() === item.answer.toLowerCase();
        showFeedback(feedback, correct, item.answer);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            checkBtn.click();
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

    checkBtn.addEventListener('click', () => {
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
        checkBtn.disabled = true;
        showFeedback(feedback, allRight, correctSet.join(', '));
    });
}

// --- DECOUPLED QUESTION CONTAINER RENDER ENGINE ---
function drawNextItem() {
    if (examDeck.length === 0) {
        examDeck = shuffle(activeExamRows);
        // Avoid asking the same question twice in a row across reshuffles
        const top = examDeck[examDeck.length - 1];
        if (examDeck.length > 1 && lastExamItem &&
            top.prompt === lastExamItem.prompt && top.answer === lastExamItem.answer) {
            [examDeck[0], examDeck[examDeck.length - 1]] = [examDeck[examDeck.length - 1], examDeck[0]];
        }
    }
    lastExamItem = examDeck.pop();
    return lastExamItem;
}

function serveQuestion(sameItem = null) {
    if (activeExamRows.length === 0) return;
    isQuestionActive = true;

    // Mode switches reuse the current question; Next draws from the deck
    const item = sameItem || drawNextItem();
    const needsCheckBtn = (examMode === 'type' || examMode === 'select');

    const testDiv = document.createElement('div');
    testDiv.className = 'exam-question-wrapper';

    // Mode switcher bar
    const modeBar = document.createElement('div');
    modeBar.className = 'exam-mode-row';
    EXAM_MODES.forEach(m => {
        const b = document.createElement('button');
        b.className = 'exam-mode-btn' + (m.id === examMode ? ' active' : '');
        b.textContent = m.label;
        b.addEventListener('click', () => {
            examMode = m.id;
            serveQuestion(item);
        });
        modeBar.appendChild(b);
    });
    // Direction toggle (A -> B or B -> A)
    const dirBtn = document.createElement('button');
    dirBtn.className = 'exam-mode-btn';
    dirBtn.style.flex = '0 0 auto';
    dirBtn.textContent = examReverse ? 'B → A' : 'A → B';
    dirBtn.addEventListener('click', () => {
        examReverse = !examReverse;
        isQuestionActive = false;
        generateMockTest();
    });
    modeBar.appendChild(dirBtn);
    testDiv.appendChild(modeBar);

    // Prompt
    const promptP = document.createElement('p');
    promptP.innerHTML = `<strong>Exam Prompt:</strong> ${esc(item.prompt)}`;
    testDiv.appendChild(promptP);

    // Mode body
    const body = document.createElement('div');
    body.className = 'exam-body';
    testDiv.appendChild(body);

    // Action row: Check (typing/select only) + Next, 50% each
    const actions = document.createElement('div');
    actions.className = 'exam-actions-row';
    actions.style.cssText = 'display: flex; gap: 8px;';

    let checkBtn = null;
    if (needsCheckBtn) {
        checkBtn = document.createElement('button');
        checkBtn.id = 'exam-submit-btn';
        checkBtn.className = 'primary-btn';
        checkBtn.style.flex = '1';
        checkBtn.textContent = 'Check Answer';
        actions.appendChild(checkBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.id = 'exam-next-btn';
    nextBtn.className = 'primary-btn';
    nextBtn.style.flex = needsCheckBtn ? '1' : '0 0 calc(50% - 4px)';
    nextBtn.textContent = 'Next ➡️';
    actions.appendChild(nextBtn);
    testDiv.appendChild(actions);

    // Feedback
    const feedback = document.createElement('p');
    feedback.id = 'exam-feedback';
    feedback.style.cssText = 'margin-top: 12px; font-weight: bold; min-height: 20px;';
    testDiv.appendChild(feedback);

    // Swap into the viewer
    const existingWrapper = recallViewer.querySelector('.exam-question-wrapper');
    if (existingWrapper) existingWrapper.remove();
    recallViewer.appendChild(testDiv);

    // Build the chosen mode
    if (examMode === 'choice') buildChoiceQuestion(item, body, feedback);
    else if (examMode === 'tf') buildTFQuestion(item, body, feedback);
    else if (examMode === 'select') buildSelectQuestion(item, body, feedback, checkBtn);
    else buildTypeQuestion(item, body, feedback, checkBtn);

    nextBtn.addEventListener('click', () => {
        isQuestionActive = false;
        serveQuestion();
    });
}

// --- SIDEBAR RESET ENGINE ENGINE ON WINDOW RESIZE ---
window.addEventListener('resize', () => {
    if (window.innerWidth > 700) {
        const toggleInput = document.querySelector('.sidebar-toggle-input');
        if (toggleInput) {
            toggleInput.checked = false;
        }
    }
});
