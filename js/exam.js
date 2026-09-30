// --- GLOBAL EXAM MODULE CONTEXT ENGINE ---
let activeExamRows = [];
let isQuestionActive = false; // Prevents header toggles from changing the question

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
        recallViewer.innerHTML = '<p style="color: #64748b; font-style: italic;">Please add data to your spreadsheet rows first!</p>';
        isQuestionActive = false; // Reset lock if data is wiped out
        return;
    }

    // 3. CORE SAFEGUARD: If a question is already active on screen, STOP here.
    // This completely prevents column header clicks from forcing a new question.
    if (isQuestionActive) {
        return; 
    }

    // 4. Initialize the loop engine sequence if no question is active
    serveQuestion();
}

// --- DECOUPLED QUESTION CONTAINER RENDER ENGINE ---
function serveQuestion() {
    // Prevent execution if rows matrix cache was cleared or unpopulated
    if (activeExamRows.length === 0) return;

    // Engaged state latch lock
    isQuestionActive = true;

    // Pick a random row item
    const randomItem = activeExamRows[Math.floor(Math.random() * activeExamRows.length)];

    // Generate the question layout wrapper template
    const testDiv = document.createElement('div');
    testDiv.className = 'exam-question-wrapper';
    testDiv.innerHTML = `
        <p><strong>Exam Prompt:</strong> ${randomItem.prompt}</p>
        <p><strong>Your Answer:</strong> <input type="text" id="exam-user-input" autocomplete="off" style="margin-bottom: 8px; width: 100%; box-sizing: border-box; padding: 8px;"></p>

        <div class="exam-actions-row" style="display: flex; gap: 8px;">
            <button id="exam-submit-btn" style="flex: 1;" class="primary-btn">Check Answer</button>
            <button id="exam-next-btn" style="flex: 1;" class="primary-btn">Next ➡️</button>
        </div>
        <p id="exam-feedback" style="margin-top: 12px; font-weight: bold; min-height: 20px;"></p>
    `;

    // Clear previous question and append the fresh template block safely
    const existingWrapper = recallViewer.querySelector('.exam-question-wrapper');
    if (existingWrapper) existingWrapper.remove();
    recallViewer.appendChild(testDiv);

    // Autofocus the user text box right away for speed typing
    document.getElementById('exam-user-input').focus();

    // Listener block A: Validate the submitted text string
    document.getElementById('exam-submit-btn').addEventListener('click', () => {
        const userInput = document.getElementById('exam-user-input').value.trim().toLowerCase();
        const correctAnswer = randomItem.answer.toLowerCase();
        const feedback = document.getElementById('exam-feedback');

        if (userInput === correctAnswer) {
            feedback.textContent = "✅ Correct! Great job.";
            feedback.style.color = "green";
        } else {
            feedback.textContent = `❌ Incorrect. Expected: "${randomItem.answer}"`;
            feedback.style.color = "red";
        }
    });

    // Listener block B: FIXED - Releases the lock and advances ONLY when Next button is clicked
    document.getElementById('exam-next-btn').addEventListener('click', () => {
        isQuestionActive = false; // Open the latch lock
        serveQuestion();          // Fire up the next question sequence
    });

    // Shortcut optimization using the Enter Key
    document.getElementById('exam-user-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('exam-submit-btn').click();
        }
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
