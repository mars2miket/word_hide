// --- LIST EXPORT / IMPORT ---
// Standalone. Only touches window.textBox, listStore, saveListStore, switchList, activeList.
// Load this AFTER spreadsheet-cl-v4.js (needs listStore + switchList to exist).

(function () {
    const exportBtn = document.getElementById('list-export-btn');
    const importBtn = document.getElementById('list-import-btn');
    const importInput = document.getElementById('list-import-input');

    if (!exportBtn || !importBtn || !importInput) return; // buttons not in HTML — bail silently

    // --- EXPORT ---
    exportBtn.addEventListener('click', () => {
        if (typeof textBox === 'undefined' || !textBox) {
            alert('Grid not ready yet.');
            return;
        }

        const text = textBox.value || '';
        if (!text.trim()) {
            alert('This list is empty — nothing to export.');
            return;
        }

        const name = (typeof activeList === 'string' && activeList.trim()) || 'list';
        const safeName = name.replace(/[\\/:*?"<>|]/g, '_'); // strip characters illegal in filenames

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        URL.revokeObjectURL(url);
    });

    // --- IMPORT ---
    importBtn.addEventListener('click', () => importInput.click());

    importInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (ev) => {
            const raw = String(ev.target.result || '').replace(/\r\n/g, '\n');

            if (!raw.trim()) {
                alert('That file is empty.');
                importInput.value = '';
                return;
            }

            // Build a name from the filename, avoiding collisions
            let baseName = file.name.replace(/\.[^.]+$/, '').trim() || 'Imported';
            let name = baseName;
            let n = 2;
            while (name in listStore) {
                name = `${baseName} (${n++})`;
            }

            // If a Note is open, close it first so the grid can take over
            if (typeof window !== 'undefined' && window.noteActive && typeof exitNoteMode === 'function') {
                exitNoteMode();
            }

            // Commit current list before switching
            if (typeof commitActiveList === 'function') commitActiveList();

            // Add to store and make it active
            listStore[name] = raw.replace(/\s+$/, '');
            if (typeof saveListStore === 'function') saveListStore();

            if (typeof activeList !== 'undefined') {
                window.activeList = name;
            }
            if (typeof loadActiveListIntoGrid === 'function') {
                loadActiveListIntoGrid();
            }
            if (typeof afterListChange === 'function') {
                afterListChange();
            }
            if (typeof switchList === 'function') {
                // Ensure UI is in sync even if loadActiveListIntoGrid skipped the switch
                switchList(name);
            }
        };

        reader.onerror = () => alert('Could not read that file.');
        reader.readAsText(file);

        // Reset so the same file can be re-imported
        importInput.value = '';
    });
})();