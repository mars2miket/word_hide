/**
 * grid.js — classic script.
 * Editable spreadsheet grid: contenteditable cells, masking, paste, delete.
 */
(function () {
  'use strict';

  var MASK_CLASS = 'recall-word';
  var HIDDEN_CLASS = 'col-hidden';
  var HIDDEN_ACTIVE_HEADER = 'col-hidden-active';

  var container = null;

  function initGrid() {
    container = document.getElementById('spreadsheet-container');
    if (!container) return;

    renderAll();

    container.addEventListener('input', onInput);
    container.addEventListener('paste', onPaste);
    container.addEventListener('focusin', onFocusIn);
    container.addEventListener('focusout', onFocusOut);

    container.querySelectorAll('.header-cell .header-label').forEach(function (label) {
      label.addEventListener('click', function () {
        toggleColumnHide(label.dataset.col);
      });
    });

    initRowDelete();

    var externalRowChange = false;

    window.subscribe(function (state, prev) {
      if (state.rows !== prev.rows && externalRowChange) renderAll();
      if (state.colHidden !== prev.colHidden) applyMaskAll();
    });

    window.__gridRerender__ = function () {
      externalRowChange = true;
      renderAll();
      externalRowChange = false;
    };

    updateCharCount();
    syncStartTestButton();

    window.updateCharCount = updateCharCount;
    window.syncStartTestButton = syncStartTestButton;
  }

  // ─── Rendering ───────────────────────────────────────────────────────────
  function renderAll() {
    if (!container) return;

    container.querySelectorAll('.data-cell').forEach(function (c) { c.remove(); });

    var rows = (window.getState().rows || []).slice();

    while (rows.length > 0) {
      var last = rows[rows.length - 1];
      if (!last.a.trim() && !last.b.trim()) rows.pop();
      else break;
    }

    rows.push({ a: '', b: '' });

    rows.forEach(function (row, i) {
      createRowCells(i + 1, row.a || '', row.b || '');
    });

    applyMaskAll();
  }

  function createRowCells(rowNum, valA, valB) {
    var cellA = document.createElement('div');
    cellA.className = 'cell data-cell';
    cellA.contentEditable = 'true';
    cellA.dataset.row = rowNum;
    cellA.dataset.col = 'A';
    cellA.textContent = valA;

    var cellB = document.createElement('div');
    cellB.className = 'cell data-cell';
    cellB.contentEditable = 'true';
    cellB.dataset.row = rowNum;
    cellB.dataset.col = 'B';
    cellB.textContent = valB;

    container.appendChild(cellA);
    container.appendChild(cellB);
  }

  // ─── Input handling ──────────────────────────────────────────────────────
  function onInput(e) {
    var cell = e.target;
    if (!cell.classList.contains('data-cell')) return;

    var rowNum = parseInt(cell.dataset.row, 10);
    var maxRow = getMaxRow();
    if (rowNum === maxRow) {
      appendEmptyRow();
    }

    commitToState();
  }

  function onPaste(e) {
    var cell = e.target;
    if (!cell.classList.contains('data-cell')) return;

    var data = e.clipboardData || window.clipboardData;
    var text = extractClipboardText(data);
    if (!text) return;

    e.preventDefault();
    distributePastedText(cell, text);
  }

  function onFocusIn(e) {
    var cell = e.target;
    if (!cell.classList.contains('data-cell')) return;
    if (cell.querySelector('.' + MASK_CLASS)) {
      unmaskCell(cell);
    }
  }

  function onFocusOut(e) {
    var cell = e.target;
    if (!cell.classList.contains('data-cell')) return;
    if (window.getState().colHidden[cell.dataset.col]) {
      maskCell(cell);
    }
  }

  // ─── Row helpers ─────────────────────────────────────────────────────────
  function getMaxRow() {
    var max = 0;
    container.querySelectorAll('.data-cell[data-col="A"]').forEach(function (c) {
      var n = parseInt(c.dataset.row, 10) || 0;
      if (n > max) max = n;
    });
    return max;
  }

  function appendEmptyRow() {
    var next = getMaxRow() + 1;
    createRowCells(next, '', '');
  }

  // ─── Paste handling ──────────────────────────────────────────────────────
  function extractClipboardText(dataSource) {
    if (!dataSource) return '';
    return (dataSource.getData && (dataSource.getData('text/plain') || dataSource.getData('text'))) || '';
  }

  function distributePastedText(targetCell, pastedText) {
    if (!targetCell.classList.contains('data-cell')) return;

    var startRow = parseInt(targetCell.dataset.row, 10);
    var startCol = targetCell.dataset.col;
    var lines = pastedText.replace(/\r\n/g, '\n').split('\n');

    if (lines.length && lines[lines.length - 1] === '') lines.pop();

    lines.forEach(function (line, i) {
      var rowNum = startRow + i;
      var cols = line.split('\t');

      var cellA = container.querySelector('.data-cell[data-row="' + rowNum + '"][data-col="A"]');
      if (!cellA) createRowCells(rowNum, '', '');

      cols.forEach(function (val, j) {
        var targetLetter = (startCol === 'A') ? ((j === 0) ? 'A' : 'B') : 'B';
        var dest = container.querySelector(
          '.data-cell[data-row="' + rowNum + '"][data-col="' + targetLetter + '"]'
        );
        if (dest) dest.textContent = val.trim();
      });
    });

    appendEmptyRow();
    commitToState();
  }

  // ─── Masking ─────────────────────────────────────────────────────────────
  function toggleColumnHide(letter) {
    var state = window.getState();
    var next = Object.assign({}, state.colHidden);
    next[letter] = !next[letter];
    window.setState({ colHidden: next });

    var headerEl = container.querySelector('.header-cell[data-col="' + letter + '"]');
    if (headerEl) {
      headerEl.classList.toggle(HIDDEN_ACTIVE_HEADER, next[letter]);
      var label = headerEl.querySelector('.header-label');
      if (label) {
        var newKey = next[letter] ? ('showCol' + letter) : ('hideCol' + letter);
        label.dataset.i18n = newKey;
        if (window.__i18n__ && typeof window.__i18n__.t === 'function') {
          label.textContent = window.__i18n__.t(newKey);
        }
      }
    }
    applyMaskAll();
  }

  function applyMaskAll() {
    var hidden = window.getState().colHidden;
    ['A', 'B'].forEach(function (letter) {
      var cells = container.querySelectorAll('.data-cell[data-col="' + letter + '"]');
      cells.forEach(function (cell) {
        if (cell === document.activeElement) return;
        if (hidden[letter]) maskCell(cell);
        else unmaskCell(cell);
      });
    });
  }

  function maskCell(cell) {
    var text = cell.textContent || '';
    if (!text) return;

    cell.innerHTML = '';
    var tokens = text.split(/(\s+)/);
    tokens.forEach(function (token) {
      if (token === '') return;
      if (/^\s+$/.test(token)) {
        cell.appendChild(document.createTextNode(token));
      } else {
        var span = document.createElement('span');
        span.className = MASK_CLASS + ' ' + HIDDEN_CLASS;
        span.textContent = token;
        cell.appendChild(span);
      }
    });
  }

  function unmaskCell(cell) {
    cell.textContent = cell.textContent;
  }

  // ─── State commit ────────────────────────────────────────────────────────
  function commitToState() {
    var rows = [];
    var maxRow = getMaxRow();

    for (var i = 1; i <= maxRow; i++) {
      var cellA = container.querySelector('.data-cell[data-row="' + i + '"][data-col="A"]');
      var cellB = container.querySelector('.data-cell[data-row="' + i + '"][data-col="B"]');
      rows.push({
        a: cellA ? cellA.textContent : '',
        b: cellB ? cellB.textContent : ''
      });
    }

    while (rows.length > 0) {
      var last = rows[rows.length - 1];
      if (!last.a.trim() && !last.b.trim()) rows.pop();
      else break;
    }
    rows.push({ a: '', b: '' });

    window.setState({ rows: rows });
    updateCharCount();
    syncStartTestButton();
  }

  // ─── Char count + Start Test ─────────────────────────────────────────────
  function updateCharCount() {
    var total = 0;
    var st = window.getState();
    if (st.viewMode === 'notes') {
      var noteArea = document.getElementById('note-area');
      total = noteArea ? noteArea.value.length : 0;
    } else {
      container.querySelectorAll('.data-cell').forEach(function (c) {
        total += (c.textContent || '').length;
      });
    }

    var charEl = document.getElementById('char-count');
    if (charEl) charEl.textContent = total;

    var estEl = document.getElementById('time-estimate');
    if (estEl) {
      var totalMinutes = total / 1000;
      var minutes = Math.floor(totalMinutes);
      var seconds = Math.floor((totalMinutes - minutes) * 60);
      estEl.textContent = minutes + 'm ' + seconds + 's';
    }
  }

  function syncStartTestButton() {
    var btn = document.getElementById('start-test-btn');
    if (!btn) return;
    var rows = window.getState().rows || [];
    var hasContent = rows.some(function (r) {
      return (r.a && r.a.trim()) || (r.b && r.b.trim());
    });
    btn.disabled = !hasContent;
  }

  // ─── Delete row ──────────────────────────────────────────────────────────
  function initRowDelete() {
    var delBtn = document.createElement('button');
    delBtn.id = 'row-delete-btn';
    delBtn.type = 'button';
    delBtn.title = 'Delete row';
    delBtn.textContent = '🗑';
    delBtn.setAttribute('aria-label', 'Delete row');
    container.appendChild(delBtn);

    var targetRow = null;

    function showFor(cell) {
      var c = container.getBoundingClientRect();
      var r = cell.getBoundingClientRect();
      delBtn.style.top  = (r.top - c.top + container.scrollTop + (r.height - 36) / 2) + 'px';
      delBtn.style.left = (r.right - c.left + container.scrollLeft - 44) + 'px';
      delBtn.classList.add('visible');
      targetRow = cell.dataset.row;
    }

    function hide() {
      delBtn.classList.remove('visible');
      targetRow = null;
    }

    container.addEventListener('mousemove', function (e) {
      if (e.target === delBtn) return;
      var cell = e.target.closest('.data-cell[data-col="B"]');
      if (!cell) { hide(); return; }
      var rect = cell.getBoundingClientRect();
      if (e.clientX >= rect.right - 56) showFor(cell);
      else hide();
    });

    container.addEventListener('mouseleave', hide);

    container.addEventListener('focusin', function (e) {
      if (e.target.matches('.data-cell[data-col="B"]') && window.matchMedia('(hover: none)').matches) {
        showFor(e.target);
      }
    });

    container.addEventListener('focusout', function (e) {
      if (e.relatedTarget !== delBtn) hide();
    });

    delBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    delBtn.addEventListener('click', function () {
      if (targetRow) deleteRowAt(targetRow);
      hide();
    });

    container.addEventListener('scroll', hide);
  }

  function deleteRowAt(rowNum) {
    var state = window.getState();
    var rows = (state.rows || []).slice();
    var idx = parseInt(rowNum, 10) - 1;

    if (idx < 0 || idx >= rows.length) return;

    rows.splice(idx, 1);

    while (rows.length > 0) {
      var last = rows[rows.length - 1];
      if (!last.a.trim() && !last.b.trim()) rows.pop();
      else break;
    }
    rows.push({ a: '', b: '' });

    window.setState({ rows: rows });
    if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
    if (typeof window.updateCharCount === 'function') window.updateCharCount();
    if (typeof window.syncStartTestButton === 'function') window.syncStartTestButton();
  }

  window.initGrid = initGrid;
})();