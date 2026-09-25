// --- CLIPBOARD INTERCEPTION DATA DISTRIBUTOR ---

// FIXED: Added your robust parser that handles escaped quotes and internal newlines
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
    if (!targetCell.classList.contains('data-cell')) return;
    
    // FIXED: Use the new robust parser instead of the old broken .split()
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
    try { localStorage.setItem('savedSpreadsheetGridData', textBox.value); } catch (err) { console.warn('localStorage save failed:', err); }
    targetCell.dispatchEvent(new Event('input', { bubbles: true }));
}
