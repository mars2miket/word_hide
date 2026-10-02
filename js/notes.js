// --- NOTES: textarea mode that swaps in for the spreadsheet + recall-viewer ---
// textBox (spreadsheet-cl-v4.js) returns the note text while window.noteActive is true,
// so Read / Loop / Speed / RWD / FF / Voice / Timer work on a Note unchanged.

window.noteActive = false;

const noteArea = document.getElementById('note-area');
const noteSelect = document.getElementById('note-select');
const noteResizer = document.getElementById('note-resizer');
const noteWorkspace = document.querySelector('.input-workspace');
const noteNewBtn = document.getElementById('note-new-btn');
const noteRenameBtn = document.getElementById('note-rename-btn');
const noteDeleteBtn = document.getElementById('note-delete-btn');

function loadNoteStore() {
    try { return JSON.parse(localStorage.getItem('whNotes')) || {}; } catch (err) { return {}; }
}
function saveNoteStore() {
    try { localStorage.setItem('whNotes', JSON.stringify(noteStore)); } catch (err) { console.warn('note save failed:', err); }
}

let noteStore = loadNoteStore();
let activeNote = null;

function refreshNoteSelect() {
    noteSelect.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '';
    noteSelect.appendChild(blank);
    Object.keys(noteStore).forEach(name => {
        const op = document.createElement('option');
        op.value = name;
        op.textContent = name;
        noteSelect.appendChild(op);
    });
    noteSelect.value = window.noteActive ? activeNote : '';
}

function stopReadingAndExam() {
    if (typeof stopBtn !== 'undefined' && stopBtn) stopBtn.click();
    if (typeof resetExam === 'function') resetExam();
}

function enterNote(name) {
    if (!(name in noteStore)) return;
    activeNote = name;
    window.noteActive = true;
    noteArea.value = noteStore[name];
    noteWorkspace.classList.add('note-mode');
    if (typeof addRowBtn !== 'undefined' && addRowBtn) addRowBtn.disabled = true;
    stopReadingAndExam();
    if (typeof listSelect !== 'undefined' && listSelect) listSelect.selectedIndex = -1;
    refreshNoteSelect();
    try {
        localStorage.setItem('whMode', 'note');
        localStorage.setItem('whActiveNote', name);
    } catch (err) {}
    updateCharacterCount();
}

function exitNoteMode() {
    if (!window.noteActive) return;
    window.noteActive = false;
    noteWorkspace.classList.remove('note-mode');
    if (typeof addRowBtn !== 'undefined' && addRowBtn) addRowBtn.disabled = false;
    stopReadingAndExam();
    refreshNoteSelect();
    if (typeof refreshListSelect === 'function') refreshListSelect();
    if (typeof colHiddenState !== 'undefined' && (colHiddenState.A || colHiddenState.B) && typeof generateMockTest === 'function') generateMockTest();
    try { localStorage.setItem('whMode', 'list'); } catch (err) {}
    updateCharacterCount();
}

// Used by the Clear Columns button (timer.js) while a Note is open
function clearActiveNote() {
    if (!window.noteActive) return;
    noteArea.value = '';
    noteStore[activeNote] = '';
    saveNoteStore();
    updateCharacterCount();
}

noteSelect.addEventListener('change', () => {
    if (!noteSelect.value) exitNoteMode();
    else enterNote(noteSelect.value);
});

noteArea.addEventListener('input', () => {
    if (!window.noteActive) return;
    noteStore[activeNote] = noteArea.value;
    saveNoteStore();
    updateCharacterCount();
});

noteNewBtn.addEventListener('click', () => {
    const name = (prompt('New note name:') || '').trim();
    if (!name) return;
    if (name in noteStore) { alert('A note with that name already exists.'); return; }
    noteStore[name] = '';
    saveNoteStore();
    enterNote(name);
});

noteRenameBtn.addEventListener('click', () => {
    if (!window.noteActive) { alert('Select a note first.'); return; }
    const name = (prompt('Rename note:', activeNote) || '').trim();
    if (!name || name === activeNote) return;
    if (name in noteStore) { alert('A note with that name already exists.'); return; }
    const renamed = {};
    Object.keys(noteStore).forEach(k => { renamed[k === activeNote ? name : k] = noteStore[k]; });
    noteStore = renamed;
    activeNote = name;
    saveNoteStore();
    try { localStorage.setItem('whActiveNote', name); } catch (err) {}
    refreshNoteSelect();
});

noteDeleteBtn.addEventListener('click', () => {
    if (!window.noteActive) { alert('Select a note first.'); return; }
    if (!confirm(`Delete "${activeNote}"?`)) return;
    delete noteStore[activeNote];
    saveNoteStore();
    activeNote = null;
    exitNoteMode();
});

// Height resize handle (same behavior as the spreadsheet row-resizer)
noteResizer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    noteResizer.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const startHeight = noteArea.getBoundingClientRect().height;
    noteResizer.classList.add('resizing');

    function onPointerMove(e2) {
        noteArea.style.height = `${Math.max(80, startHeight + (e2.clientY - startY))}px`;
    }
    function onPointerUp(e2) {
        noteResizer.classList.remove('resizing');
        noteResizer.releasePointerCapture(e2.pointerId);
        noteResizer.removeEventListener('pointermove', onPointerMove);
        noteResizer.removeEventListener('pointerup', onPointerUp);
    }
    noteResizer.addEventListener('pointermove', onPointerMove);
    noteResizer.addEventListener('pointerup', onPointerUp);
});

// Startup: restore last-opened Note if that's where the user left off
(function initNotes() {
    refreshNoteSelect();
    const savedName = localStorage.getItem('whActiveNote');
    if (localStorage.getItem('whMode') === 'note' && savedName && savedName in noteStore) enterNote(savedName);
})();
