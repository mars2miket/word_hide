// --- FIX: DETECT MOBILE BROWSERS UNIFORMLY ---
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// --- CLIPBOARD INTERCEPTION DATA DISTRIBUTOR ---
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
    
    const parsedRows = parseClipboardText(pastedText);
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

// --- FIX: CREATE AND MANAGE HIDDEN SANDBOX FOR MOBILE OS INTERCEPTION ---
const pasteSandbox = document.createElement('textarea');
pasteSandbox.style.position = 'fixed';
pasteSandbox.style.opacity = '0';
pasteSandbox.style.top = '0';
pasteSandbox.style.left = '0';
pasteSandbox.style.width = '1px';
pasteSandbox.style.height = '1px';
pasteSandbox.style.zindex = '-9999';
document.body.appendChild(pasteSandbox);

// Intercept execution pathways across different mobile engines
spreadsheetContainer.addEventListener('paste', (e) => {
    if (!e.target.classList.contains('data-cell')) return;
    
    const targetCell = e.target;
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = extractClipboardText(clipboardData);

    if (pastedText && (pastedText.includes('\t') || pastedText.includes('\n'))) {
        e.preventDefault();
        distributePastedText(targetCell, pastedText);
    } else if (isMobile) {
        // Fallback for restricted mobile copy/paste streams
        e.preventDefault();
        pasteSandbox.value = '';
        pasteSandbox.focus();
        
        // Let system process native thread then pull data out
        setTimeout(() => {
            const fallbackText = pasteSandbox.value;
            targetCell.focus();
            if (fallbackText) distributePastedText(targetCell, fallbackText);
        }, 10);
    }
});

// Capture variations of beforeinput before native OS text engines can collapse layout structure
spreadsheetContainer.addEventListener('beforeinput', (e) => {
    if (e.inputType !== 'insertFromPaste') return;
    if (!e.target.classList.contains('data-cell')) return;
    
    const targetCell = e.target;
    const text = extractClipboardText(e.dataTransfer);
    
    if (text && (text.includes('\t') || text.includes('\n'))) {
        e.preventDefault();
        distributePastedText(targetCell, text);
    } else if (isMobile) {
        e.preventDefault();
        pasteSandbox.value = '';
        pasteSandbox.focus();
        
        setTimeout(() => {
            const fallbackText = pasteSandbox.value;
            targetCell.focus();
            if (fallbackText) distributePastedText(targetCell, fallbackText);
        }, 10);
    }
});
