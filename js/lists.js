/**
 * lists.js — classic script.
 * Manages the "Lists" data, dropdown population, and CRUD actions.
 * Export/Import respect the current view (lists vs notes).
 */
(function () {
  'use strict';

  var exportBtn, importBtn, importInput;

  var RESULTS_KEY = '__TEST_RESULTS__';

  function t(key, fallback) {
    var v = (window.__i18n__ && window.__i18n__.t) ? window.__i18n__.t(key) : null;
    return (v && v !== key) ? v : fallback;
  }
  function say(msg) {
    if (typeof window.showAlert === 'function') window.showAlert('', msg); else alert(msg);
  }
  function ask(title, msg, def, cb) {
    if (typeof window.showPrompt === 'function') { window.showPrompt(title, msg, def, cb); return; }
    var raw = window.prompt(msg, def);
    if (raw !== null) cb(raw);
  }

  function initLists() {
    exportBtn   = document.getElementById('list-export-btn');
    importBtn   = document.getElementById('list-import-btn');
    importInput = document.getElementById('list-import-input');

    if (exportBtn) exportBtn.addEventListener('click', onExport);
    if (importBtn && importInput) {
      importBtn.addEventListener('click', function () { importInput.click(); });
      importInput.addEventListener('change', onImport);
    }

    // Bootstrap: ensure at least one list exists on first load
    var st = window.getState();
    if (Object.keys(st.lists || {}).length === 0) {
      var defaultIdentifier = '__DEFAULT_LIST__';
      var seeded = {};
      seeded[defaultIdentifier] = '';
      window.setState({
        lists: seeded,
        activeList: defaultIdentifier,
        rows: [{ a: '', b: '' }]
      });
    } else if (!st.activeList || !(st.activeList in st.lists)) {
      var first = Object.keys(st.lists)[0];
      window.setState({
        activeList: first,
        rows: parseList(st.lists[first])
      });
    }

    window.getDisplayName = function (key, viewMode) {
      if (key === '__DEFAULT_LIST__' && viewMode === 'lists') {
        return t('dropdownLists', 'Untitled List');
      }
      if (key === '__DEFAULT_NOTE__' && viewMode === 'notes') {
        return t('dropdownNotes', 'Untitled Note');
      }
      if (key === '__MISSED_QUESTIONS__' && viewMode === 'lists') {
        return t('missedListName', 'Missed Questions');
      }
      if (key === '__TEST_RESULTS__' && viewMode === 'notes') {
        return t('testResultsNote', 'Test Results');
      }
      return key;
    };

    window.listActions = {
      create: onNewList,
      rename: onRenameList,
      remove: onDeleteList
    };
  }

  // ─── New / Rename / Delete ───────────────────────────────────────────────
  function onNewList() {
    ask(t('newList', 'New list'), t('promptNewList', 'New list name:'), '', function (raw) {
      var name = raw.trim();
      if (!name) return;

      var state = window.getState();
      if (name in state.lists) { say(t('errListExists', 'A list with that name already exists.')); return; }

      var lists = Object.assign({}, state.lists);
      if (state.activeList && typeof window.serializeGrid === 'function') {
        lists[state.activeList] = window.serializeGrid();
      }
      lists[name] = '';

      window.setState({
        lists: lists,
        activeList: name,
        rows: [{ a: '', b: '' }]
      });
      if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
    });
  }

  function onRenameList() {
    var state = window.getState();
    if (state.activeList === '__MISSED_QUESTIONS__') {
      say(t('errMissedListLocked', 'The Missed Questions list cannot be renamed.'));
      return;
    }

    var current = state.activeList;
    var shown = (typeof window.getDisplayName === 'function') ? window.getDisplayName(current, 'lists') : current;
    
    ask(t('renameList', 'Rename list'), t('promptRenameList', 'Rename list:'), shown, function (raw) {
      var name = raw.trim();
      var st = window.getState();
      if (!name || name === current) return;
      if (name in st.lists) { say(t('errListExists', 'A list with that name already exists.')); return; }

      var lists = {};
      Object.keys(st.lists).forEach(function (k) {
        lists[k === current ? name : k] = st.lists[k];
      });

      window.setState({ lists: lists, activeList: name });
    });
  }

  function onDeleteList() {
    var state = window.getState();
    if (Object.keys(state.lists).length <= 1) {
      say(t('errNeedOneList', 'You need at least one list.'));
      return;
    }

    var target = state.activeList;
    var doDelete = function () {
      var lists = Object.assign({}, state.lists);
      delete lists[target];
      var nextActive = Object.keys(lists)[0];

      window.setState({
        lists: lists,
        activeList: nextActive,
        rows: parseList(lists[nextActive])
      });
      if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
    };

    if (typeof window.showConfirm === 'function') {
      window.showConfirm(
        t('deleteList', 'Delete list'),
        t('deleteConfirmMsg', 'Delete "{name}"? This cannot be undone.').replace('{name}', (typeof window.getDisplayName === 'function') ? window.getDisplayName(target, 'lists') : target),
        t('deleteBtn', 'Delete'),
        doDelete
      );
    } else if (window.confirm('Delete "' + target + '"?')) {
      doDelete();
    }
  }

  // ─── Export (view-aware) ─────────────────────────────────────────────────
  function onExport() {
    var state = window.getState();

    if (state.viewMode === 'notes') {
      exportNote(state);
      return;
    }

    // Lists view (default)
    var text = window.serializeGrid ? window.serializeGrid() : '';
    if (!text.trim()) { say(t('errListEmpty', 'This list is empty — nothing to export.')); return; }

    var shownName = (typeof window.getDisplayName === 'function') ? window.getDisplayName(state.activeList, 'lists') : state.activeList;
    downloadText(shownName || 'list', text);
  }

  function exportNote(state) {
    var key = state.activeNote;
    if (!key || key === RESULTS_KEY) {
      say(t('errNoNoteToExport', 'No note is selected to export.'));
      return;
    }

    var text = (state.notes && state.notes[key]) || '';
    if (!text.trim()) { say(t('errNoteEmpty', 'This note is empty — nothing to export.')); return; }

    var shownName = (typeof window.getDisplayName === 'function') ? window.getDisplayName(key, 'notes') : key;
    downloadText(shownName || 'note', text);
  }

  function downloadText(name, text) {
    var safeName = (name || 'export').replace(/[\\/:*?"<>|]/g, '_');
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);

    var a = document.createElement('a');
    a.href = url;
    a.download = safeName + '.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ─── Import (view-aware) ─────────────────────────────────────────────────
  function onImport(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    var okExt = /\.(txt|csv|tsv|md)$/i.test(file.name);
    if (!okExt) {
      say(t('errBadFileType', 'Only .txt, .tsv, .md and .csv files are allowed.'));
      importInput.value = '';
      return;
    }

    var MAX_BYTES = 500 * 1024;
    if (file.size > MAX_BYTES) {
      say(t('errFileTooLarge', 'File too large. Max 500 KB.'));
      importInput.value = '';
      return;
    }

    var reader = new FileReader();
    reader.onload = function (ev) {
      var raw = String(ev.target.result || '').replace(/\r\n/g, '\n');
      if (!raw.trim()) { say(t('errFileEmpty', 'That file is empty.')); importInput.value = ''; return; }

      var baseName = file.name.replace(/\.[^.]+$/, '').trim() || 'Imported';

      var viewMode = window.getState().viewMode;
      if (viewMode === 'notes') {
        importAsNote(baseName, raw);
      } else {
        importAsList(baseName, raw);
      }

      importInput.value = '';
    };
    reader.onerror = function () { say(t('errFileRead', 'Could not read that file.')); importInput.value = ''; };
    reader.readAsText(file);
  }

  function importAsList(baseName, raw) {
    var name = baseName;
    var n = 2;
    var state = window.getState();
    while (name in state.lists) { name = baseName + ' (' + (n++) + ')'; }

    var lists = Object.assign({}, state.lists);
    if (state.activeList && typeof window.serializeGrid === 'function') {
      lists[state.activeList] = window.serializeGrid();
    }
    lists[name] = raw.replace(/\s+$/, '');

    window.setState({
      lists: lists,
      activeList: name,
      rows: parseList(lists[name])
    });
    if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
  }

  function importAsNote(baseName, raw) {
    var name = baseName;
    var n = 2;
    var state = window.getState();
    while (name in state.notes || name === RESULTS_KEY) {
      name = baseName + ' (' + (n++) + ')';
    }

    var notes = Object.assign({}, state.notes);
    notes[name] = raw.replace(/\s+$/, '');

    window.setState({
      notes: notes,
      activeNote: name,
      noteActive: true,
      viewMode: 'notes'
    });
  }

  // ─── Serialization helpers ───────────────────────────────────────────────
  function serializeGrid() {
    var rows = window.getState().rows || [];
    return rows.map(function (r) {
      return (r.a || '') + '\t' + (r.b || '');
    }).join('\n');
  }

  function parseList(text) {
    if (!text) return [{ a: '', b: '' }];
    var rows = text.replace(/\r\n/g, '\n').split('\n').map(function (line) {
      var cols = line.split('\t');
      return { a: cols[0] || '', b: cols[1] || '' };
    });
    if (rows.length === 0) rows.push({ a: '', b: '' });
    return rows;
  }

  // Expose
  window.initLists = initLists;
  window.serializeGrid = serializeGrid;
  window.parseList = parseList;
})();