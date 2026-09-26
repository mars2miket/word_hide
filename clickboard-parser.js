// --- UNIFIED CROSS-PLATFORM CLIPBOARD PARSER & GRID MATRIX DISTRIBUTOR ---

function parseClipboardText(text) {
  const result = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') { // Handling escaped quotes ""
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes; // Toggle quote state
      }
    } else if (char === '\t' && !inQuotes) { // Next column
      row.push(cell);
      cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) { // Next row
      if (char === '\r' && nextChar === '\n') i++; // Handle CRLF
      row.push(cell);
      result.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell);
    result.push(row);
  }
  return result;
}

function distributePastedText(targetCell, pastedText) {
    if (!targetCell || !targetCell.classList.contains('data-cell')) return;
    
    if (window.__PASTE_DEBUG__) {
        alert('PASTE DEBUG - raw text received:\n\n' + pastedText.replace(/\t/g, '[TAB]').replace(/\n/g, '[NEWLINE]\n'));
    }
    
    // Catch mobile clipboards that swap literal tabs for blocks of spaces
    let sanitizedText = pastedText;
    if (!sanitizedText.includes('\t') && sanitizedText.includes('  ')) {
        sanitizedText = sanitizedText.replace(/ {2,}/g, '\t');
    }

    const parsedRows = parseClipboardText(sanitizedText);
    const startRow = parseInt(targetCell.dataset.row, 10);
    const startCol = targetCell.dataset.col;

    parsedRows.forEach((columns, rowIndex) => {
        const currentRowNum = startRow + rowIndex;
        let cellA = spreadsheetContainer.querySelector(`.data-cell[data-row="${currentRowNum}"][data-col="A"]`);
        if (!cellA) {
            createRowCells(currentRowNum, "", "");
        }

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

    isTextDirty = true;
    updateCharacterCount();
    try { 
        localStorage.setItem('savedSpreadsheetGridData', textBox.value); 
    } catch (err) { 
        console.warn('localStorage save failed:', err); 
    }
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

// --- BULLETPROOF MOBILE & DESKTOP EVENT INTERCEPTORS ---

// Handle standard desktop pasting and explicit clipboard event API access
spreadsheetContainer.addEventListener('paste', (e) => {
    if (!e.target.classList.contains('data-cell')) return;
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = extractClipboardText(clipboardData);
    
    if (pastedText && (pastedText.includes('\t') || pastedText.includes('\n') || pastedText.includes('  '))) {
        e.preventDefault();
        distributePastedText(e.target, pastedText);
    }
});

// Capture multi-cell text insertions right before they commit to the layout tree
spreadsheetContainer.addEventListener('textInput', (e) => {
    if (!e.target.classList.contains('data-cell')) return;
    const data = e.data;
    if (data && (data.includes('\n') || data.includes('\r') || data.includes('\t') || data.includes('  '))) {
        e.preventDefault();
        distributePastedText(e.target, data);
    }
});

// Catch-all mutation listener with frame deferral to prevent mobile input stream collisions
spreadsheetContainer.addEventListener('input', (e) => {
    if (!e.target.classList.contains('data-cell')) return;
    const targetCell = e.target;
    const rawText = targetCell.textContent;
    
    if (rawText.includes('\n') || rawText.includes('\r') || rawText.includes('\t') || rawText.includes('  ')) {
        // Wait exactly 1 frame animation loop so mobile text buffer finishes streaming
        requestAnimationFrame(() => {
            const processingText = targetCell.textContent;
            targetCell.textContent = ''; // Safely clear without interrupting active input thread
            distributePastedText(targetCell, processingText);
        });
    } else {
        // Keep your original data saving behavior intact for standard typing mutations
        isTextDirty = true;
        updateCharacterCount();
        try { 
            localStorage.setItem('savedSpreadsheetGridData', textBox.value); 
        } catch (err) { 
            console.warn('localStorage save failed:', err); 
        }
    }
});
