/**
 * workspace-toggle.js — classic script.
 * Manages the [Lists | Notes] toggle and the dynamic dropdown below it.
 */
(function () {
  'use strict';

  var toggle, viewSelect;

  function initWorkspaceToggle() {
    toggle     = document.getElementById('seg-toggle');
    viewSelect = document.getElementById('view-select');
    if (!toggle || !viewSelect) return;

    // Wire toggle buttons
    toggle.querySelectorAll('.seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setMode(btn.dataset.mode);
      });
    });

    // Wire the dropdown
    viewSelect.addEventListener('change', onDropdownChange);

    // React to state changes
    window.subscribe(function (state, prev) {
      if (state.viewMode !== prev.viewMode) {
        applyMode();
      }
      if (state.lists !== prev.lists
       || state.activeList !== prev.activeList
       || state.notes !== prev.notes
       || state.activeNote !== prev.activeNote) {
        refreshDropdown();
      }
    });

    // Initial render
    applyMode();
  }

  // ─── Mode switching ──────────────────────────────────────────────────────
  function setMode(mode) {
    var state = window.getState();
    if (state.viewMode === mode) return;

    // Save the current grid into its list before leaving Lists mode
    if (mode === 'notes' && typeof window.serializeGrid === 'function') {
      var lists = Object.assign({}, state.lists);
      if (state.activeList) {
        lists[state.activeList] = window.serializeGrid();
        window.setState({ lists: lists });
      }
    }

    // Sync noteActive flag
    if (mode === 'notes') {
      // Restore last note, or fall back to placeholder
      var lastNote = state.activeNote;
      var noteExists = lastNote && lastNote in state.notes;
      window.setState({
        viewMode: 'notes',
        noteActive: !!noteExists,
        activeNote: noteExists ? lastNote : null
      });
    } else {
      window.setState({
        viewMode: 'lists',
        noteActive: false
      });
    }

    applyMode();
  }

  function applyMode() {
    var state = window.getState();
    var mode = state.viewMode || 'lists';

    // Toggle active state
    toggle.querySelectorAll('.seg-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });

    // Refresh dropdown options
    refreshDropdown();
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────
  function refreshDropdown() {
    var state = window.getState();
    var mode = state.viewMode || 'lists';

    viewSelect.innerHTML = '';

    if (mode === 'lists') {
      var listNames = Object.keys(state.lists || {});

      // Placeholder
      var ph = document.createElement('option');
      ph.value = '';
      ph.textContent = 'Select a List';
      viewSelect.appendChild(ph);

      listNames.forEach(function (name) {
        var op = document.createElement('option');
        op.value = name;
        op.textContent = name;
        viewSelect.appendChild(op);
      });

      // Restore last selected list
      viewSelect.value = state.activeList && state.activeList in state.lists
        ? state.activeList
        : '';

    } else {
      var noteNames = Object.keys(state.notes || {});

      var ph2 = document.createElement('option');
      ph2.value = '';
      ph2.textContent = 'Select a Note';
      viewSelect.appendChild(ph2);

      noteNames.forEach(function (name) {
        var op = document.createElement('option');
        op.value = name;
        op.textContent = name;
        viewSelect.appendChild(op);
      });

      // Restore last selected note
      viewSelect.value = state.activeNote && state.activeNote in state.notes
        ? state.activeNote
        : '';
    }
  }

  function onDropdownChange() {
    var name = viewSelect.value;
    var state = window.getState();

    if (state.viewMode === 'lists') {
      // Selected a list
      if (!name || !(name in state.lists)) return;
      if (name === state.activeList) return;

      // Save current grid into outgoing list
      var lists = Object.assign({}, state.lists);
      if (state.activeList) {
        lists[state.activeList] = window.serializeGrid();
      }

      window.setState({
        lists: lists,
        activeList: name,
        rows: window.parseList ? window.parseList(lists[name]) : []
      });

      if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
      if (typeof window.updateCharCount === 'function') window.updateCharCount();
      if (typeof window.syncStartTestButton === 'function') window.syncStartTestButton();

    } else {
      // Selected a note
      if (!name || !(name in state.notes)) {
        // Placeholder picked — exit note
        window.setState({ noteActive: false, activeNote: null });
        return;
      }

      window.setState({
        noteActive: true,
        activeNote: name
      });

      var noteArea = document.getElementById('note-area');
      if (noteArea) noteArea.value = state.notes[name] || '';
    }
  }

  window.initWorkspaceToggle = initWorkspaceToggle;
})();