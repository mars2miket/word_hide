// --- GLOBAL EXAM MODULE CONTEXT ENGINE ---
let activeExamRows = [];
let isQuestionActive = false; // Prevents header toggles from changing the question
let examMode = 'type';        // 'type' | 'choice' | 'tf' | 'select'

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

function generateMockTest() {
    // 1. Extract all valid completed rows from the spreadsheet grid matrix
    activeExamRows = [];
    spreadsheetContainer.querySelectorAll('.data-cell[data-col="A"]').forEach(cellA => {
        const rowNum = cellA.dataset.row;
        const cellB = spreadsheetContainer.querySelector(`.data-cell[data-row="${rowNum}"][data-col="B"]`);
        if (cellA.textContent.trim() && cellB && cellB.textContent.trim()) {
            activeExamRows.push({
                prompt: cellA.textContent.trim(),
                answer: cellB.textContent.trim()
            });
        }
    });

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

// --- QUESTION BUILDERS (one per mode) ---
function buildTypeQuestion(item, body, feedback) {
    body.innerHTML = `
        <p><strong>Your Answer:</strong> <input type="text" id="exam-user-input" autocomplete="off" style="margin-bottom: 8px; width: 100%; box-sizing: border-box; padding: 8px;"></p>
        <button id="exam-submit-btn" style="width: 100%; margin-bottom: 8px;" class="primary-btn">Check Answer</button>
    `;
    const input = body.querySelector('#exam-user-input');
    const submit = body.querySelector('#exam-submit-btn');
    input.focus();

    submit.addEventListener('click', () => {
        const correct = input.value.trim().toLowerCase() === item.answer.toLowerCase();
        showFeedback(feedback, correct, item.answer);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submit.click();
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

function buildSelectQuestion(item, body, feedback) {
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

    const check = document.createElement('button');
    check.className = 'primary-btn';
    check.style.cssText = 'width:100%; margin-bottom:8px;';
    check.textContent = 'Check Answer';
    check.addEventListener('click', () => {
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
        check.disabled = true;
        showFeedback(feedback, allRight, correctSet.join(', '), true);
    });
    body.appendChild(check);
}

function showFeedback(el, correct, expected, plural) {
    if (correct) {
        el.textContent = "✅ Correct! Great job.";
        el.style.color = "green";
    } else {
        el.textContent = `❌ Incorrect. Expected: "${expected}"`;
        el.style.color = "red";
    }
}

// --- DECOUPLED QUESTION CONTAINER RENDER ENGINE ---
function serveQuestion() {
    if (activeExamRows.length === 0) return;
    isQuestionActive = true;

    const item = activeExamRows[Math.floor(Math.random() * activeExamRows.length)];

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
            serveQuestion();
        });
        modeBar.appendChild(b);
    });
    testDiv.appendChild(modeBar);

    // Prompt
    const promptP = document.createElement('p');
    promptP.innerHTML = `<strong>Exam Prompt:</strong> ${esc(item.prompt)}`;
    testDiv.appendChild(promptP);

    // Mode body
    const body = document.createElement('div');
    body.className = 'exam-body';
    testDiv.appendChild(body);

    // Next button
    const actions = document.createElement('div');
    actions.className = 'exam-actions-row';
    actions.style.cssText = 'display: flex; gap: 8px;';
    actions.innerHTML = `<button id="exam-next-btn" style="flex: 1;" class="primary-btn">Next ➡️</button>`;
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
    else if (examMode === 'select') buildSelectQuestion(item, body, feedback);
    else buildTypeQuestion(item, body, feedback);

    actions.querySelector('#exam-next-btn').addEventListener('click', () => {
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
