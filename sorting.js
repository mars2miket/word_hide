/**
 * --- SPREADSHEET ROW-SYNCHRONIZED SORTING ENGINE ---
 * Isolates and manages column sorting behaviors for the grid matrix.
 */

/**
 * Sorts data rows alphabetically (A-Z) based on a targeted column letter,
 * keeping Row A and Row B data bound together as unified spreadsheet entries.
 * Empty rows are automatically pushed to the bottom.
 * @param {string} letter - The column to sort by ('A' or 'B')
 */
function sortSpreadsheetByColumn(letter) {
    const rowsData = [];
    
    // Step A: Extract paired cell data rows as interconnected structural units
    spreadsheetContainer.querySelectorAll('.data-cell[data-col="A"]').forEach(cellA => {
        const rowNum = cellA.dataset.row;
        const cellB = spreadsheetContainer.querySelector(`.data-cell[data-row="${rowNum}"][data-col="B"]`);
        
        const valA = (cellA.textContent || "").trim();
        const valB = cellB ? (cellB.textContent || "").trim() : "";

        // BUG FIX: Completely discard rows that are entirely blank to clear trailing newline garbage data
        if (valA === "" && valB === "") {
            return;
        }
        
        rowsData.push({ valA, valB });
    });

    // Prevent execution if no row text matrix data exists to sort
    if (rowsData.length === 0) return;

    // Step B: Reorder the units alphabetically while keeping empty strings at the bottom
    rowsData.sort((rowX, rowY) => {
        const textX = (letter === 'A' ? rowX.valA : rowX.valB).toLowerCase();
        const textY = (letter === 'A' ? rowY.valA : rowY.valB).toLowerCase();

        // BUG FIX: Strict empty string validation tracking
        if (textX === "" && textY !== "") return 1;  // Push rowX to the bottom
        if (textX !== "" && textY === "") return -1; // Push rowY to the bottom
        if (textX === "" && textY === "") return 0;  // Leave them equal

        // Standard alphabetical sorting for active text cells
        return textX.localeCompare(textY);
    });

    // Step C: Flush existing rows completely from the layout grid container matrix
    spreadsheetContainer.querySelectorAll('.data-cell').forEach(c => c.remove());
    
    // Step D: Re-render rows systematically into the DOM from sorted trace cache arrays
    rowsData.forEach((rowData, index) => {
        createRowCells(index + 1, rowData.valA, rowData.valB);
    });

    // Step E: Update global character counts and write changes to cache storage
    if (typeof updateCharacterCount === 'function') {
        updateCharacterCount();
    }
    
    try { 
        if (window.textBox && typeof textBox.value !== 'undefined') {
            localStorage.setItem('savedSpreadsheetGridData', textBox.value); 
        }
    } catch (err) { 
        console.warn('localStorage save failed inside sorting engine:', err); 
    }
}

/**
 * Initializer function to bind header sort buttons to the sorting engine.
 * Safely handles click propagation to separate sorting from hiding actions.
 */
function initializeSortingControls() {
    spreadsheetContainer.querySelectorAll('.header-cell').forEach(headerEl => {
        const columnLetter = headerEl.dataset.col;
        const sortBtn = headerEl.querySelector('.header-sort-btn');
        
        if (sortBtn) {
            sortBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents grid layout hide events from cascading accidentally
                sortSpreadsheetByColumn(columnLetter);
            });
        }
    });
}

// Automatically mount button click event hooks once script is evaluated
document.addEventListener('DOMContentLoaded', () => {
    initializeSortingControls();
});
