// --- MASTER SYSTEM INITIALIZATION ---
const synth = window.speechSynthesis;

// Element Selectors Mapping Layout Matrix
const spreadsheetContainer = document.getElementById('spreadsheet-container');
const recallViewer = document.getElementById('recall-viewer');
const clearBtn = document.getElementById('clear-btn');

const genderFilter = document.getElementById('gender-filter');
const voiceSearch = document.getElementById('voice-search'); 
const voiceSelect = document.getElementById('voice-select');
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const loopCheck = document.getElementById('loop-check');
const readBtn = document.getElementById('read-btn');
const stopBtn = document.getElementById('stop-btn');
const rewindBtn = document.getElementById('rewind-btn');
const forwardBtn = document.getElementById('forward-btn');

const charCountDisplay = document.getElementById('char-count');
const timeEstimateDisplay = document.getElementById('time-estimate');
const timerDisplay = document.getElementById('timer-display');
const timerResetBtn = document.getElementById('timer-reset-btn');

// Core Application States Tracker
window.__PASTE_DEBUG__ = true; // TEMP: shows a popup with the raw pasted text for diagnosis
let hideStage = 0;
let isTextDirty = true;
let allVoices = [];
let filteredVoices = [];
let isLoopEnabled = false;
let currentUtterance = null;
let lastCharacterIndex = 0;
let isVoicePaused = false; 
let currentSpeakingSpan = null;
let didAutoShowViewer = false;

let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;

let speechChunks = [];
let currentChunkIndex = 0;
let chunkBaseIndex = 0;
let isChunkTransitionCancelled = false;

const CHUNK_CHAR_LIMIT = 250;
const SEEK_WORD_COUNT = 5;

const femaleKeywords = [ 
    'adri', 'amala', 'andrea', 'anna', 'aria', 'asilia', 'ava', 'belkys', 
    'catalina', 'christel', 'clara', 'elena', 'elsa', 'emily', 'emma', 
    'ezinne', 'female', 'google uk english female', 'hazel', 'heera', 
    'imani', 'ingrid', 'ja', 'jenny', 'joana', 'karen', 'katja', 'leah', 
    'leni', 'libby', 'luna', 'maria', 'michelle', 'moira', 'molly', 
    'natasha', 'nia', 'ramona', 'rosa', 'salome', 'samantha', 'seraphina', 
    'sofia', 'sonia', 'tessa', 'vesna', 'victoria', 'vlasta', 'yan', 'zira'
];

// Structural Virtual Engine: Mock textbox element interface to maintain script logic compatibility
const textBox = {
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
        // FIXED: Removed the aggressive return condition that breaks row synchronization
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
// Tracking text edits within spreadsheet
spreadsheetContainer.addEventListener('input', (e) => {
    if (e.target.classList.contains('data-cell')) {
        const raw = e.target.textContent;
        
        // Catch unintercepted multi-cell dumps (e.g., from mobile keyboards)
        if (raw.includes('\t') || raw.includes('\n')) {
            // CRITICAL FIX: Clear the target cell first so the text doesn't 
            // double up inside it during distribution.
            e.target.textContent = ''; 
            distributePastedText(e.target, raw);
            return;
        }
        
        isTextDirty = true;
        updateCharacterCount();
        try { 
            localStorage.setItem('savedSpreadsheetGridData', textBox.value); 
        } catch (err) { 
            console.warn('localStorage save failed:', err); 
        }
    }
});


function updateCharacterCount() {
    // Character logic counts visible characters inside structural cells only
    let charCount = 0;
    spreadsheetContainer.querySelectorAll('.data-cell').forEach(c => charCount += c.textContent.length);
    charCountDisplay.textContent = charCount;
    const totalMinutes = charCount / 1000;
    const minutes = Math.floor(totalMinutes);
    const remainderSeconds = Math.floor((totalMinutes - minutes) * 60);
    timeEstimateDisplay.textContent = `${minutes}m ${remainderSeconds}s`;
}

// Enter moves to the next cell/row instead of inserting a line break in-cell
// Catch mobile/Android bypass paths that use alternative input types
spreadsheetContainer.addEventListener('beforeinput', (e) => {
    // CRITICAL FIX: Intercept both standard paste events AND regular text inserts 
    // if they originate from a clipboard data transfer channel
    if (e.inputType !== 'insertFromPaste' && e.inputType !== 'insertText') return;
    if (!e.target.classList.contains('data-cell')) return;
    
    const text = extractClipboardText(e.dataTransfer);
    if (!text) return; 

    // Only take over if it's actually an array of cells (contains tabs or newlines)
    if (text.includes('\t') || text.includes('\n')) {
        e.preventDefault();
        distributePastedText(e.target, text);
    }
});


// --- CLIPBOARD INTERCEPTION DATA DISTRIBUTOR ---
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

    isTextDirty = true;
    updateCharacterCount();
    try { localStorage.setItem('savedSpreadsheetGridData', textBox.value); } catch (err) { console.warn('localStorage save failed:', err); }
    targetCell.dispatchEvent(new Event('input', { bubbles: true }));
}

// Converts an HTML clipboard payload (e.g. a <table> from Google Sheets) into
// tab/newline-delimited text. Some Android copy paths only put text/html on
// the clipboard, not a clean tab-separated text/plain, which previously
// caused the whole paste to land in a single cell.
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
    if (!pastedText) return; // nothing readable at all; let a beforeinput fallback try
    e.preventDefault();
    distributePastedText(e.target, pastedText);
});

// Many Android/mobile browsers don't fire a usable 'paste' ClipboardEvent on
// contenteditable elements - they only fire 'beforeinput' with
// inputType 'insertFromPaste', and the default action dumps the whole
// clipboard blob into one cell. Catch that case here.
spreadsheetContainer.addEventListener('beforeinput', (e) => {
    if (e.inputType !== 'insertFromPaste') return;
    if (!e.target.classList.contains('data-cell')) return;
    const text = extractClipboardText(e.dataTransfer);
    if (!text) return; // nothing we can read synchronously; let default happen
    e.preventDefault();
    distributePastedText(e.target, text);
});

// --- HIGH-SPEED PRE-RENDERED ACTIVE RECALL ENGINE ---
const colHiddenState = { A: false, B: false };
let didColumnShowViewer = false;

function preRenderTextGrid() {
    recallViewer.innerHTML = '';
    const cleanRawString = textBox.value.replace(/\t/g, ' ').split('\n');
    let runningIndex = 0;

    cleanRawString.forEach((para, pIdx) => {
        const rowNum = pIdx + 1;
        const cellA = spreadsheetContainer.querySelector(`.data-cell[data-row="${rowNum}"][data-col="A"]`);
        const colACount = cellA ? cellA.textContent.trim().split(/\s+/).filter(Boolean).length : 0;

        const words = para.split(' ');
        words.forEach((word, wIdx) => {
            const wordStart = runningIndex;
            runningIndex += word.length + 1;
            if (!word.trim()) return;
            
            const span = document.createElement('span');
            span.className = "recall-word";
            span.textContent = word;
            span.dataset.start = wordStart;
            span.dataset.end = wordStart + word.length;
            span.setAttribute('data-mod3', wIdx % 3);
            span.setAttribute('data-rand', Math.random() < 0.5 ? "true" : "false");
            span.setAttribute('data-col', wIdx < colACount ? 'A' : 'B');
            if (colHiddenState[span.getAttribute('data-col')]) span.classList.add('col-hidden');
            
            span.addEventListener('click', () => {
                const computedStyle = window.getComputedStyle(span);
                if (computedStyle.backgroundColor === computedStyle.color || span.classList.contains('revealed')) {
                    span.classList.toggle('revealed');
                }
            });
            recallViewer.appendChild(span);
            recallViewer.appendChild(document.createTextNode(" "));
        });
        if (pIdx < cleanRawString.length - 1) {
            recallViewer.appendChild(document.createElement('br'));
        }
    });
    isTextDirty = false;
}



function getWordSpanAtIndex(charIndex) {
    const spans = recallViewer.getElementsByClassName('recall-word');
    for (const span of spans) {
        if (charIndex >= Number(span.dataset.start) && charIndex < Number(span.dataset.end)) return span;
    }
    return null;
}



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
        if (cell === document.activeElement) return; // don't mask the cell being actively edited
        if (colHiddenState[letter]) maskCell(cell); else unmaskCell(cell);
    });
}

// While editing a hidden cell, show plain text; re-mask when focus leaves
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

// --- PER-COLUMN HIDE TOGGLE ---
function toggleColumnHide(letter) {
    if (isTextDirty) preRenderTextGrid();
    colHiddenState[letter] = !colHiddenState[letter];

    const headerEl = spreadsheetContainer.querySelector(`.header-cell[data-col="${letter}"]`);
    headerEl.classList.toggle('col-hidden-active', colHiddenState[letter]);

    applyCellMaskForColumn(letter);

    recallViewer.querySelectorAll(`.recall-word[data-col="${letter}"]`).forEach(el => {
        el.classList.toggle('col-hidden', colHiddenState[letter]);
    });

    const anyActive = colHiddenState.A || colHiddenState.B;
    if (anyActive) {
        if (recallViewer.classList.contains('hidden')) {
            recallViewer.style.height = `${spreadsheetContainer.offsetHeight}px`;
            recallViewer.classList.remove('hidden');
            didColumnShowViewer = true;
        }
    } else if (didColumnShowViewer && hideStage === 0 && !synth.speaking) {
        recallViewer.classList.add('hidden');
        didColumnShowViewer = false;
    }
}

spreadsheetContainer.querySelectorAll('.header-cell').forEach(headerEl => {
    const label = headerEl.querySelector('.header-label');
    if (label) label.addEventListener('click', () => toggleColumnHide(headerEl.dataset.col));
});

// --- VOICE PROCESSING MANAGEMENT LAYER (TTS) ---
function guessGender(voiceName) {
    const name = voiceName.toLowerCase();
    return femaleKeywords.some(kw => name.includes(kw)) ? 'female' : 'male';
}

function clearSpeakingHighlight() {
    if (currentSpeakingSpan) {
        currentSpeakingSpan.classList.remove('speaking');
        currentSpeakingSpan = null;
    }
}

function highlightWordAt(absoluteIndex) {
    if (hideStage > 0) return;
    if (isTextDirty) preRenderTextGrid();

    if (recallViewer.classList.contains('hidden')) {
        recallViewer.style.height = `${spreadsheetContainer.offsetHeight}px`;
        recallViewer.classList.remove('hidden');
        didAutoShowViewer = true;
    }
    const span = getWordSpanAtIndex(absoluteIndex);
    if (span && span !== currentSpeakingSpan) {
        clearSpeakingHighlight();
        span.classList.add('speaking');
        currentSpeakingSpan = span;
    }
}

function stopHighlighting() {
    clearSpeakingHighlight();
    if (didAutoShowViewer) {
        recallViewer.classList.add('hidden');
        didAutoShowViewer = false;
    }
}

function populateVoices() {
    allVoices = synth.getVoices();
    if (allVoices.length === 0) return;
    
    allVoices.sort((a, b) => a.name.localeCompare(b.name));
    const savedGenderFilter = localStorage.getItem('savedGenderFilter') || 'all';
    genderFilter.value = savedGenderFilter;

    const searchQuery = voiceSearch.value.toLowerCase().trim();
    filteredVoices = allVoices.filter(v => {
        const matchesG = (savedGenderFilter === 'all') || (guessGender(v.name) === savedGenderFilter);
        return matchesG && `${v.name} ${v.lang}`.toLowerCase().includes(searchQuery);
    });

    voiceSelect.innerHTML = '';
    const savedVoiceName = localStorage.getItem('savedVoiceNameString');
    let targetIdx = 0;

    filteredVoices.forEach((voice, i) => {
        const op = document.createElement('option');
        op.value = i;
        op.textContent = `${voice.name} (${voice.lang}) [${guessGender(voice.name).toUpperCase()}]`;
        if (savedVoiceName === voice.name) targetIdx = i;
        voiceSelect.appendChild(op);
    });

    if (filteredVoices.length > 0) {
        voiceSelect.selectedIndex = targetIdx;
        localStorage.setItem('savedVoiceNameString', filteredVoices[targetIdx].name);
    } else {
        const op = document.createElement('option');
        op.textContent = "No matches found";
        voiceSelect.appendChild(op);
    }
}

if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = populateVoices;
populateVoices();

let voiceSearchDebounce;
voiceSearch.addEventListener('input', () => {
    clearTimeout(voiceSearchDebounce);
    voiceSearchDebounce = setTimeout(populateVoices, 150);
});

genderFilter.addEventListener('change', () => {
    localStorage.setItem('savedGenderFilter', genderFilter.value);
    localStorage.removeItem('savedVoiceNameString');
    populateVoices();
});

voiceSelect.addEventListener('change', () => {
    if (filteredVoices[voiceSelect.value]) localStorage.setItem('savedVoiceNameString', filteredVoices[voiceSelect.value].name);
});

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

readBtn.addEventListener('click', () => {
    if (allVoices.length === 0) populateVoices();

    if (synth.speaking && !isVoicePaused) {
        stopTimer();
        isChunkTransitionCancelled = true;
        synth.cancel();
        isVoicePaused = true;
        readBtn.textContent = "Read";
        readBtn.classList.remove('is-active');
    } else if (isVoicePaused) {
        isVoicePaused = false;
        readBtn.textContent = "Pause ⏸";
        readBtn.classList.add('is-active');
        const remaining = textBox.value.replace(/\t/g, ' ').replace(/\n/g, ' ').substring(lastCharacterIndex);
        if (remaining.trim() !== "") speakText(remaining, true);
    } else {
        speakText();
    }
});

function speakText(textOverride = null, isMidSentenceResume = false) {
    if (!isMidSentenceResume && !textOverride) {
        if (synth.speaking) { isChunkTransitionCancelled = true; synth.cancel(); }
        lastCharacterIndex = 0;
        isVoicePaused = false;
        readBtn.textContent = "Read";
        readBtn.classList.remove('is-active');
    }
    
    // Normalizes row characters safely so engine highlights without breaking
    const textToRead = textOverride || textBox.value.replace(/\t/g, ' ').replace(/\n/g, ' ');
    if (!textToRead.trim()) return;

    readBtn.textContent = "Pause ⏸";
    readBtn.classList.add('is-active');

    const utteranceBaseIndex = isMidSentenceResume ? lastCharacterIndex : 0;
    speechChunks = splitIntoChunks(textToRead, CHUNK_CHAR_LIMIT);
    currentChunkIndex = 0;
    chunkBaseIndex = utteranceBaseIndex;

    startTimer();
    playCurrentChunk();
}

function playCurrentChunk() {
    const chunkText = speechChunks[currentChunkIndex];
    const thisChunkBaseIndex = chunkBaseIndex;
    lastCharacterIndex = thisChunkBaseIndex;

    currentUtterance = new SpeechSynthesisUtterance(chunkText);
    if (filteredVoices[voiceSelect.value]) currentUtterance.voice = filteredVoices[voiceSelect.value];
    currentUtterance.rate = parseFloat(speedSlider.value);

    currentUtterance.onboundary = (e) => {
        if (e.name === 'word') {
            const absIdx = thisChunkBaseIndex + e.charIndex;
            lastCharacterIndex = absIdx;
            highlightWordAt(absIdx);
        }
    };

    currentUtterance.onend = () => {
        if (isChunkTransitionCancelled) { isChunkTransitionCancelled = false; return; }
        currentChunkIndex++;
        chunkBaseIndex = thisChunkBaseIndex + chunkText.length;
        if (currentChunkIndex < speechChunks.length) {
            playCurrentChunk();
        } else {
            if (isLoopEnabled) { lastCharacterIndex = 0; speakText(); } 
            else { stopTimer(); lastCharacterIndex = 0; isVoicePaused = false; readBtn.textContent = "Read"; readBtn.classList.remove('is-active'); stopHighlighting(); }
        }
    };
    synth.speak(currentUtterance);
}

speedSlider.addEventListener('input', () => {
    speedValue.textContent = `${speedSlider.value}x`;
    if (synth.speaking && !isVoicePaused) {
        stopTimer(); isChunkTransitionCancelled = true; synth.cancel();
        const rem = textBox.value.replace(/\t/g, ' ').replace(/\n/g, ' ').substring(lastCharacterIndex);
        if (rem.trim() !== "") speakText(rem, true);
    }
});

loopCheck.addEventListener('click', () => {
    isLoopEnabled = !isLoopEnabled;
    loopCheck.textContent = isLoopEnabled ? "Loop: ON" : "Loop: OFF";
    loopCheck.classList.toggle('loop-on', isLoopEnabled);
});

function seekBy(wordDelta) {
    const wasActive = synth.speaking && !isVoicePaused;
    const txt = textBox.value.replace(/\t/g, ' ').replace(/\n/g, ' ');
    let idx = lastCharacterIndex;

    if (wordDelta > 0) {
        for (let i = 0; i < wordDelta; i++) {
            while (idx < txt.length && !/\s/.test(txt[idx])) idx++;
            while (idx < txt.length && /\s/.test(txt[idx])) idx++;
        }
    } else {
        for (let i = 0; i < -wordDelta; i++) {
            while (idx > 0 && /\s/.test(txt[idx - 1])) idx--;
            while (idx > 0 && !/\s/.test(txt[idx - 1])) idx--;
        }
    }
    lastCharacterIndex = Math.max(0, Math.min(idx, txt.length));

    if (wasActive) {
        stopTimer(); isChunkTransitionCancelled = true; synth.cancel();
        const remaining = txt.substring(lastCharacterIndex);
        if (remaining.trim() !== "") speakText(remaining, true);
        else { isVoicePaused = false; readBtn.textContent = "Read"; readBtn.classList.remove('is-active'); stopHighlighting(); }
    } else {
        highlightWordAt(lastCharacterIndex);
    }
}

rewindBtn.addEventListener('click', () => seekBy(-SEEK_WORD_COUNT));
forwardBtn.addEventListener('click', () => seekBy(SEEK_WORD_COUNT));

stopBtn.addEventListener('click', () => {
    isLoopEnabled = false; loopCheck.textContent = "Loop: OFF"; loopCheck.classList.remove('loop-on');
    isChunkTransitionCancelled = true; synth.cancel(); stopTimer();
    isVoicePaused = false; readBtn.textContent = "Read"; readBtn.classList.remove('is-active');
    lastCharacterIndex = 0; stopHighlighting();
});

// --- PERFORMANCE DISPLAY TIMER ---
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(() => {
        elapsedTime = Date.now() - startTime;
        let totalS = Math.floor(elapsedTime / 1000);
        let m = Math.floor(totalS / 60).toString().padStart(2, '0');
        let s = (totalS % 60).toString().padStart(2, '0');
        let t = Math.floor((elapsedTime % 1000) / 100);
        timerDisplay.textContent = `${m}:${s}.${t}`;
    }, 100);
}
function stopTimer() { clearInterval(timerInterval); timerInterval = null; }
timerResetBtn.addEventListener('click', () => { stopTimer(); elapsedTime = 0; timerDisplay.textContent = "00:00.0"; });


clearBtn.addEventListener('click', () => {
    spreadsheetContainer.querySelectorAll('.data-cell').forEach(c => c.remove());
    createRowCells(1, "", "");
    localStorage.setItem('savedSpreadsheetGridData', '');
    updateCharacterCount();
    if (synth.speaking) synth.cancel();
    stopTimer(); lastCharacterIndex = 0; stopHighlighting(); resetHideMode();
    isVoicePaused = false; readBtn.textContent = "Read"; readBtn.classList.remove('is-active');
});


// --- PERSISTENCE STARTUP ADAPTER ---
try {
    const savedText = localStorage.getItem('savedSpreadsheetGridData');
    if (savedText) { textBox.value = savedText; } else { updateCharacterCount(); }
} catch (err) {
    console.warn('localStorage unavailable, skipping restore:', err);
    updateCharacterCount();
}
