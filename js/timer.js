// --- DOMAIN 4: CHRONO RUNTIME PERFORMANCE WATCHDOG ---

window.startTimer = function() {
    if (timerInterval) clearInterval(timerInterval);
    window.startTime = Date.now() - elapsedTime;
    window.timerInterval = setInterval(() => {
        window.elapsedTime = Date.now() - startTime;
        let totalS = Math.floor(elapsedTime / 1000);
        let m = Math.floor(totalS / 60).toString().padStart(2, '0');
        let s = (totalS % 60).toString().padStart(2, '0');
        let t = Math.floor((elapsedTime % 1000) / 100);
        timerDisplay.textContent = `${m}:${s}.${t}`;
    }, 100);
};

window.stopTimer = function() { 
    clearInterval(timerInterval); 
    window.timerInterval = null; 
};

timerResetBtn.addEventListener('click', () => { 
    stopTimer(); 
    window.elapsedTime = 0; 
    timerDisplay.textContent = "00:00.0"; 
});

clearBtn.addEventListener('click', () => {
    spreadsheetContainer.querySelectorAll('.data-cell').forEach(c => c.remove());
    if (typeof createRowCells === 'function') createRowCells(1, "", "");
    localStorage.setItem('savedSpreadsheetGridData', '');
    if (typeof updateCharacterCount === 'function') updateCharacterCount();
    if (synth.speaking) synth.cancel();
    stopTimer(); 
    window.lastCharacterIndex = 0; 
    if (typeof stopHighlighting === 'function') stopHighlighting();
    window.isVoicePaused = false; 
    readBtn.textContent = "Read"; 
    readBtn.classList.remove('is-active');
});
