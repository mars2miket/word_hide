/**
 * TTS Loopr - Clipboard & Text Parsing Subsystem
 * Scope: Pure parsing utility layers. No direct DOM UI interactions.
 */

/**
 * A robust parser that handles escaped quotes and newlines inside cells
 * Maps standard tab-separated spreadsheet values into cleanly matched row arrays.
 */
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

/**
 * Converts an HTML clipboard payload (e.g. a <table> from Google Sheets) into
 * tab/newline-delimited text to clean out nested styles.
 */
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

/**
 * Resolves standard plain text variations and structural MIME type extractions.
 */
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

/**
 * Safe utility to parse sentence structural blocks based on limits 
 * ensuring Text-To-Speech execution boundaries don't overflow buffer spaces.
 */
function splitIntoChunks(text, maxLen) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        if (text.length - start <= maxLen) {
            chunks.push(text.slice(start));
            break;
        }
        let searchEnd = start + maxLen;
        let splitAt = -1;
        for (let i = searchEnd; i > start; i--) {
            if (/[.!?]/.test(text[i - 1])) { splitAt = i; break; }
        }
        if (splitAt === -1) {
            for (let i = searchEnd; i > start; i--) {
                if (/\s/.test(text[i])) { splitAt = i + 1; break; }
            }
        }
        if (splitAt === -1 || splitAt <= start) splitAt = searchEnd;
        chunks.push(text.slice(start, splitAt));
        start = splitAt;
    }
    return chunks;
}
