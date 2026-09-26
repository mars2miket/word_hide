// --- DOMAIN 2: GRID CONTROL SYSTEM & CONTENT INGESTION ---

// Structural Virtual Engine TextBox Interface
window.textBox = {
    get value() { return getSpreadsheetText(); },
    set value(val) { setSpreadsheetText(val); },
    get offsetHeight() { return spreadsheetContainer.offsetHeight; }
};

// Aggregates grid matrix values row-by-row into continuous multi-line strings safely
function getSpreadsheetText() {
    const cells = spreadsheetContainer.querySelectorAll('.data-cell');
    let combinedText = "";
    cells.forEach((cell, index) => {
        const text = cell.textContent.trim();
        combinedText += text + (index % 2 === 0 ? "\t" : "\n");
    });
    return combinedText;
}

// Spreads sequential tabbed data streams inside individual grid structures
function setSpreadsheetText(text) {
    spreadsheetContainer.querySelectorAll('.data-cell').forEach(c => c.remove());
    const lines = text.split(/\r?\n/);
    let validRowCounter = 1;

    lines.forEach((line) => {
        const cols = line.split('\t');
        createRowCells(validRowCounter, cols[0] || "", cols[1] || "");
        validRowCounter++;
    });
    updateCharacterCount();
}

function createRowCells(rowNum, valA = "", valB = "") {
    const cellA = document.createElement('div');
    cellA.className = 'cell data-cell';
    cellA.contentEditable = 'true';
    cellA.dataset.row = rowNum;
    cellA.dataset.col = 'A';
    cellA.textContent = valA;

    const cellB = document.createElement('div');
    cellB.className = 'cell data-cell';
    cellB.contentEditable = 'true';
    cellB.dataset.row = rowNum;
    cellB.dataset.col = 'B';
    cellB.textContent = valB;

    spreadsheetContainer.appendChild(cellA);
    spreadsheetContainer.appendChild(cellB);

    if (colHiddenState.A && valA) maskCell(cellA);
    if (colHiddenState.B && valB) maskCell(cellB);
}

// Tracking text edits within spreadsheet
spreadsheetContainer.addEventListener('input', (e) => {
    if (e.target.classList.contains('data-cell')) {
        const raw = e.target.textContent;
        if (raw.includes('\t') || raw.includes('\n')) {
            e.target.textContent = ''; 
            distributePastedText(e.target, raw);
            return;
        }
        window.isTextDirty = true;
        updateCharacterCount();
        try { 
            localStorage.setItem('savedSpreadsheetGridData', textBox.value); 
        } catch (err) { 
            console.warn('localStorage save failed:', err); 
        }
    }
});

function updateCharacterCount() {
    let charCount = 0;
    spreadsheetContainer.querySelectorAll('.data-cell').forEach(c => charCount += c.textContent.length);
    charCountDisplay.textContent = charCount;
    const totalMinutes = charCount / 1000;
    const minutes = Math.floor(totalMinutes);
    const remainderSeconds = Math.floor((totalMinutes - minutes) * 60);
    timeEstimateDisplay.textContent = `${minutes}m ${remainderSeconds}s`;
}

// Intercept clipboard hooks
spreadsheetContainer.addEventListener('beforeinput', (e) => {
    if (e.inputType !== 'insertFromPaste' && e.inputType !== 'insertText') return;
    if (!e.target.classList.contains('data-cell')) return;
    
    const text = extractClipboardText(e.dataTransfer);
    if (!text) return; 

    if (text.includes('\t') || text.includes('\n')) {
        e.preventDefault();
        distributePastedText(e.target, text);
    }
});

function distributePastedText(targetCell, pastedText) {
    if (!targetCell.classList.contains('data-cell')) return;
    if (window.__PASTE_DEBUG__) {
        alert('PASTE DEBUG - raw text received:\n\n' + pastedText.replace(/\t/g, '[TAB]').replace(/\n/g, '[NEWLINE]\n'));
    }
    const rows = pastedText.split(/\r?\n/).filter(r => r.trim() !== '');
    const startRow = parseInt(targetCell.dataset.row, 10);
    const startCol = targetCell.dataset.col;

    rows.forEach((rowText, rowIndex) => {
        const currentRowNum = startRow + rowIndex;
        let cellA = spreadsheetContainer.querySelector(`.data-cell[data-row="${currentRowNum}"][data-col="A"]`);
        if (!cellA) {
            createRowCells(currentRowNum, "", "");
        }

        const columns = rowText.split('\t');
        columns.forEach((cellText, colIndex) => {
            let targetColLetter = (startCol === 'A') ? (colIndex === 0 ? 'A' : 'B') : 'B';
            const destinationCell = spreadsheetContainer.querySelector(
                `.data-cell[data-row="${currentRowNum}"][data-col="${targetColLetter}"]`
            );
            if (destinationCell) {
                destinationCell.textContent = cellText.trim();
            }
        });
    });

    window.isTextDirty = true;
    updateCharacterCount();
    try { localStorage.setItem('savedSpreadsheetGridData', textBox.value); } catch (err) { console.warn('localStorage save failed:', err); }
    targetCell.dispatchEvent(new Event('input', { bubbles: true }));
}

function htmlTableToDelimitedText(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return null;
    const rows = Array.from(table.querySelectorAll('tr'));
    if (!rows.length) return null;
    return rows.map(tr =>
        Array.from(tr.querySelectorAll('td, th')).map(cell => cell.textContent.trim()).join('\t')
    ).join('\n');
}

function extractClipboardText(dataSource) {
    if (!dataSource) return '';
    const plain = dataSource.getData('text/plain') || dataSource.getData('text') || '';
    if (plain.includes('\t') || plain.includes('\n')) return plain;
    const html = dataSource.getData('text/html');
    if (html) {
        const fromTable = htmlTableToDelimitedText(html);
        if (fromTable) return fromTable;
    }
    return plain;
}

spreadsheetContainer.addEventListener('paste', (e) => {
    if (!e.target.classList.contains('data-cell')) return;
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = extractClipboardText(clipboardData);
    if (!pastedText) return; 
    e.preventDefault();
    distributePastedText(e.target, pastedText);
});

// --- COLUMN RESIZE ---
(function setupColumnResize() {
    const resizer = spreadsheetContainer.querySelector('.resizer');
    if (!resizer) return;
    resizer.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        resizer.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const containerWidth = spreadsheetContainer.getBoundingClientRect().width;
        const colAEl = spreadsheetContainer.querySelector('.header-cell[data-col="A"]');
        const startWidthA = colAEl.getBoundingClientRect().width;
        resizer.classList.add('resizing');

        function onPointerMove(e2) {
            const delta = e2.clientX - startX;
            const minWidth = 60;
            let newA = Math.min(Math.max(minWidth, startWidthA + delta), containerWidth - minWidth);
            const newB = containerWidth - newA;
            spreadsheetContainer.style.gridTemplateColumns = `${newA}px ${newB}px`;
        }
        function onPointerUp(e2) {
            resizer.classList.remove('resizing');
            resizer.releasePointerCapture(e2.pointerId);
            resizer.removeEventListener('pointermove', onPointerMove);
            resizer.removeEventListener('pointerup', onPointerUp);
        }
        resizer.addEventListener('pointermove', onPointerMove);
        resizer.addEventListener('pointerup', onPointerUp);
    });
})();

// --- ROW AREA (HEIGHT) RESIZE ---
(function setupRowResize() {
    const handle = document.querySelector('.row-resizer');
    if (!handle) return;
    handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        const startY = e.clientY;
        const startHeight = spreadsheetContainer.getBoundingClientRect().height;
        handle.classList.add('resizing');

        function onPointerMove(e2) {
            const delta = e2.clientY - startY;
            const newHeight = Math.max(80, startHeight + delta);
            spreadsheetContainer.style.maxHeight = 'none';
            spreadsheetContainer.style.height = `${newHeight}px`;
        }
        function onPointerUp(e2) {
            handle.classList.remove('resizing');
            handle.releasePointerCapture(e2.pointerId);
            handle.removeEventListener('pointermove', onPointerMove);
            handle.removeEventListener('pointerup', onPointerUp);
        }
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
    });
})();

// --- IN-CELL WORD MASKING ---
function maskCell(cell) {
    const text = cell.textContent;
    cell.innerHTML = '';
    text.split(/(\s+)/).forEach(token => {
        if (token === '') return;
        if (/^\s+$/.test(token)) {
            cell.appendChild(document.createTextNode(token));
        } else {
            const span = document.createElement('span');
            span.className = 'recall-word col-hidden';
            span.textContent = token;
            cell.appendChild(span);
        }
    });
}

function unmaskCell(cell) {
    cell.textContent = cell.textContent;
}

function applyCellMaskForColumn(letter) {
    spreadsheetContainer.querySelectorAll(`.data-cell[data-col="${letter}"]`).forEach(cell => {
        if (cell === document.activeElement) return; 
        if (colHiddenState[letter]) maskCell(cell); else unmaskCell(cell);
    });
}

spreadsheetContainer.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('data-cell') && e.target.querySelector('.recall-word')) {
        unmaskCell(e.target);
    }
});
spreadsheetContainer.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('data-cell') && colHiddenState[e.target.dataset.col]) {
        maskCell(e.target);
    }
});

// --- PER-COLUMN HIDE TOGGLE INTERCEPT BRIDGE ---
function toggleColumnHide(letter) {
    // Legacy structural check -> If modular exam script exists, route layout logic there
    if (typeof generateMockTest === 'function') {
        generateMockTest();
    }
    
    colHiddenState[letter] = !colHiddenState[letter];
    const headerEl = spreadsheetContainer.querySelector(`.header-cell[data-col="${letter}"]`);
    if (headerEl) headerEl.classList.toggle('col-hidden-active', colHiddenState[letter]);

    applyCellMaskForColumn(letter);

    if (recallViewer.classList.contains('hidden')) {
        recallViewer.style.height = `${spreadsheetContainer.offsetHeight}px`;
        recallViewer.classList.remove('hidden');
    }
}

spreadsheetContainer.querySelectorAll('.header-cell').forEach(headerEl => {
    const label = headerEl.querySelector('.header-label');
    if (label) label.addEventListener('click', () => toggleColumnHide(headerEl.dataset.col));
});

// Persistence Startup Adapter Initializer
try {
    const savedText = localStorage.getItem('savedSpreadsheetGridData');
    if (savedText) { textBox.value = savedText; } else { updateCharacterCount(); }
} catch (err) {
    console.warn('localStorage unavailable, skipping restore:', err);
    updateCharacterCount();
}
