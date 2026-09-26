// --- ACTIVE RECALL EXAM MODULE ---

function generateMockTest() {
    // 1. Target and clear the viewer container
    recallViewer.innerHTML = '<h3>📝 Recall Exam</h3>';
    
    // 2. Extract all valid completed rows from the spreadsheet grid
    const rows = [];
    spreadsheetContainer.querySelectorAll('.data-cell[data-col="A"]').forEach(cellA => {
        const rowNum = cellA.dataset.row;
        const cellB = spreadsheetContainer.querySelector(`.data-cell[data-row="${rowNum}"][data-col="B"]`);
        if (cellA.textContent.trim() && cellB && cellB.textContent.trim()) {
            rows.push({ 
                prompt: cellA.textContent.trim(), 
                answer: cellB.textContent.trim() 
            });
        }
    });

    // 3. Prevent crash if there is no data inside the grid matrix
    if (rows.length === 0) {
        recallViewer.innerHTML += '<p style="color: #64748b; font-style: italic;">Please add data to your spreadsheet rows first!</p>';
        return;
    }

    // 4. Inner function execution framework to serve a new question layout
    function serveQuestion() {
        // Pick a random row item
        const randomItem = rows[Math.floor(Math.random() * rows.length)];

        // Generate the question and control wrapper
        const testDiv = document.createElement('div');
        testDiv.className = 'exam-question-wrapper';
        testDiv.innerHTML = `
            <p><strong>Prompt:</strong> ${randomItem.prompt}</p>
            <p><strong>Your Answer:</strong> <input type="text" id="exam-user-input" autocomplete="off" style="margin-bottom: 8px; width: 100%; box-sizing: border-box; padding: 8px;"></p>

            <div class="exam-actions-row" style="display: flex; gap: 8px;">
                <button id="exam-submit-btn" style="flex: 1;" class="primary-btn">Check Answer</button>
                <button id="exam-next-btn" style="flex: 1;" class="primary-btn" >Next ➡️</button>
            </div>
            <p id="exam-feedback" style="margin-top: 12px; font-weight: bold; min-height: 20px;"></p>
        `;

        // Clear previous question and append the fresh template block
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

        // Listener block B: Go to next question when clicking the Next button
        document.getElementById('exam-next-btn').addEventListener('click', () => {
            serveQuestion();
        });

        // Bonus tracking engine loop: Form submission shortcut optimization using the Enter Key
        document.getElementById('exam-user-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('exam-submit-btn').click();
            }
        });
    }

    // Initialize the loop engine sequence
    serveQuestion();
}
