/**
 * workspace-toggle.js — classic script.
 * Manages view switching and the dynamic dropdown below it.
 */
(function () {
  'use strict';

  var toggle, viewSelect, vsBtn, vsList;
  var LOCKED = ['__MISSED_QUESTIONS__', '__TEST_RESULTS__'];

  // ─── Custom dropdown ─────────────────────────────────────────────────────
  function ensureCustomDropdown() {
    vsBtn = document.getElementById('vs-btn');
    vsList = document.getElementById('vs-list');
    // HTML already has the wrapper, we just need the references.
  }

  function buildCustom() {
    if (!vsBtn || !vsList || !viewSelect) return;

    var cur = viewSelect.options[viewSelect.selectedIndex];
    vsBtn.textContent = cur ? cur.textContent : '';
    vsList.innerHTML = '';

    function pick(v) {
      viewSelect.value = v;
      viewSelect.dispatchEvent(new Event('change'));
      vsList.classList.remove('open');
    }

    Array.prototype.forEach.call(viewSelect.options, function (op) {
      var row = document.createElement('div');
      row.className = 'vs-item' + (op.value === viewSelect.value ? ' active' : '');

      var label = document.createElement('span');
      label.className = 'vs-label';
      label.textContent = op.textContent;
      row.appendChild(label);
      
      row.addEventListener('click', function () { pick(op.value); });

      if (LOCKED.indexOf(op.value) === -1) {
        var pen = document.createElement('button');
        pen.type = 'button';
        pen.className = 'vs-edit';
        pen.title = 'Rename';
        pen.textContent = '✎';
        pen.addEventListener('click', function (e) {
          e.stopPropagation();
          pick(op.value);
          var a = window.getState().viewMode === 'lists' ? window.listActions : window.noteActions;
          if (a && typeof a.rename === 'function') a.rename();
        });
        row.appendChild(pen);
      }
      vsList.appendChild(row);
    });
  }

  // ─── Init ────────────────────────────────────────────────────────────────
  function initWorkspaceToggle() {
    toggle     = document.getElementById('seg-toggle');
    viewSelect = document.getElementById('view-select');
    if (!toggle || !viewSelect) return;

    ensureCustomDropdown();

    if (vsBtn && vsList) {
      vsBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        vsList.classList.toggle('open');
      });
      document.addEventListener('click', function () { vsList.classList.remove('open'); });
    }

    // Wire toggle buttons
    toggle.querySelectorAll('.seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.id === 'qbank-open-btn') return; // handled by qbank.js
        setMode(btn.dataset.mode);
      });
    });

    // Wire the (hidden) native dropdown
    viewSelect.addEventListener('change', onDropdownChange);

    // Wire privacy link
    var privacyLink = document.getElementById('privacy-link');
    if (privacyLink) {
      privacyLink.addEventListener('click', function (e) {
        e.preventDefault();
        setMode('privacy');
      });
    }

    // Wire privacy back button
    var privacyBackBtn = document.getElementById('privacy-back-btn');
    if (privacyBackBtn) {
      privacyBackBtn.addEventListener('click', function () {
        setMode('lists');
      });
    }

    // Wire management buttons
    var mgmtNew    = document.getElementById('mgmt-new-btn');
    var mgmtDelete = document.getElementById('mgmt-delete-btn');
    
    function runMgmt(action) {
      var mode = window.getState().viewMode;
      var actions = (mode === 'lists') ? window.listActions : window.noteActions;
      if (actions && typeof actions[action] === 'function') {
        actions[action]();
      }
    }

    if (mgmtNew)    mgmtNew.addEventListener('click',    function () { runMgmt('create'); });
    if (mgmtDelete) mgmtDelete.addEventListener('click', function () { runMgmt('remove'); });

    // Actions popup (⋯)
    var menuBtn = document.getElementById('mgmt-menu-btn');
    var menuGroup = document.getElementById('mgmt-group');
    
    function closeMenu() {
      if (!menuGroup) return;
      menuGroup.classList.remove('open');
      if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    }
    
    if (menuBtn && menuGroup) {
      menuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = menuGroup.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      menuGroup.addEventListener('click', closeMenu);
      document.addEventListener('click', function (e) {
        if (!menuGroup.contains(e.target) && e.target !== menuBtn) closeMenu();
      });
    }

    // React to state changes
    window.subscribe(function (state, prev) {
      if (state.viewMode !== prev.viewMode) {
        applyMode();
      }
      if (state.lists !== prev.lists
       || state.activeList !== prev.activeList
       || state.notes !== prev.notes
       || state.activeNote !== prev.activeNote
       || state.lang !== prev.lang) {
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

    if (mode === 'analytics' && typeof window.stopSpeech === 'function' &&
        (state.isSpeaking || state.isPaused)) {
      window.stopSpeech();
    }

    // Save the current grid into its list before leaving Lists mode
    if (state.viewMode === 'lists' && typeof window.serializeGrid === 'function') {
      var lists = Object.assign({}, state.lists);
      if (state.activeList) {
        lists[state.activeList] = window.serializeGrid();
        window.setState({ lists: lists });
      }
    }

    // Update state layout keys
    if (mode === 'notes') {
      var lastNote = state.activeNote;
      var noteExists = lastNote && lastNote in state.notes;
      var targetNote = noteExists ? lastNote : Object.keys(state.notes)[0];
      window.setState({
        viewMode: 'notes',
        noteActive: !!targetNote,
        activeNote: targetNote || null
      });
    } else {
      window.setState({
        viewMode: mode,
        noteActive: false
      });
    }

    applyMode();
  }

  function applyMode() {
    var state = window.getState();
    var mode = state.viewMode || 'lists';

    document.documentElement.setAttribute('data-view-mode', mode);
    document.body.setAttribute('data-view-mode', mode);

    toggle.querySelectorAll('.seg-btn').forEach(function (b) {
      if (b.dataset.mode) {
        b.classList.toggle('active', b.dataset.mode === mode);
      }
    });

    if (mode !== 'analytics') {
      refreshDropdown();
    }

    if (typeof window.updateCharCount === 'function') window.updateCharCount();
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────
  function refreshDropdown() {
    var state = window.getState();
    var mode = state.viewMode || 'lists';

    if (!viewSelect) return;
    viewSelect.innerHTML = '';

    if (mode === 'lists') {
      var listNames = Object.keys(state.lists || {});
      listNames.forEach(function (name) {
        var op = document.createElement('option');
        op.value = name;
        op.textContent = (window.getDisplayName) ? window.getDisplayName(name, 'lists') : name;
        viewSelect.appendChild(op);
      });

      viewSelect.value = state.activeList && state.activeList in state.lists
        ? state.activeList
        : (listNames[0] || '');

    } else if (mode === 'notes') {
      var noteNames = Object.keys(state.notes || {});
      noteNames.forEach(function (name) {
        var op = document.createElement('option');
        op.value = name;
        op.textContent = (window.getDisplayName) ? window.getDisplayName(name, 'notes') : name;
        viewSelect.appendChild(op);
      });

      viewSelect.value = state.activeNote && state.activeNote in state.notes
        ? state.activeNote
        : (noteNames[0] || '');
    }

    buildCustom();
  }

  function onDropdownChange() {
    var name = viewSelect.value;
    var state = window.getState();

    if (state.viewMode === 'lists') {
      if (!name || !(name in state.lists)) return;
      if (name === state.activeList) return;

      var lists = Object.assign({}, state.lists);
      if (state.activeList && typeof window.serializeGrid === 'function') {
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

    } else if (state.viewMode === 'notes') {
      if (!name || !(name in state.notes)) return;

      window.setState({
        noteActive: true,
        activeNote: name
      });
    }
  }

  window.initWorkspaceToggle = initWorkspaceToggle;
  window.setViewMode = setMode;
})();