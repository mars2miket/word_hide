// --- UNIFIED CROSS-PLATFORM CLIPBOARD MANAGER ---

// Robust delimiter matrix parser
function parseClipboardText(text) {
  const result = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === '\t' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
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

// Intercepts the raw text stream and splits columns cleanly
function distributePastedText(targetCell, pastedText) {
    if (!targetCell || !targetCell.classList.contains('data-cell')) return;
    
    if (window.__PASTE_DEBUG__) {
        alert('PASTE DEBUG - raw text received:\n\n' + pastedText.replace(/\t/g, '[TAB]').replace(/\n/g, '[NEWLINE]\n'));
    }
    
    // ANDROID OPTIMIZATION: If the data contains multiple spaces but no tabs, 
    // try to convert dual-spaces into tabs to catch spreadsheet column splits.
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

// --- SECURE INPUT INTERCEPTION RE-ROUTE LOOP ---

// Standard Desktop Paste Event
spreadsheetContainer.addEventListener('paste', (e) => {
    if (!e.target.classList.contains('data-cell')) return;
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = extractClipboardText(clipboardData);
    
    if (pastedText) {
        e.preventDefault();
        distributePastedText(e.target, pastedText);
    }
});

// Mobile Paste Event Interceptor Catch-All
spreadsheetContainer.addEventListener('input', (e) => {
    if (!e.target.classList.contains('data-cell')) return;
    
    const rawText = e.target.textContent;
    
    // Check if the input contains multi-row patterns or multiple spacing signatures 
    // common to spreadsheet data streams that land on mobile clipboards.
    if (rawText.includes('\n') || rawText.includes('\r') || rawText.includes('\t') || rawText.includes('  ')) {
        // Clear the destination cell immediately before it double-distributes text blocks
        e.target.textContent = ''; 
        distributePastedText(e.target, rawText);
    }
});
