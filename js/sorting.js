/**
 * js/features/grid/sorting.js
 * Handles column sorting and updates state.
 */

function sortSpreadsheetByColumn(letter) {
  var state = window.getState();
  var rows = (state.rows || []).slice();

  var filled = rows.filter(function (r) {
    return (r.a && r.a.trim()) || (r.b && r.b.trim());
  });

  if (filled.length === 0) return;

  var dirKey = letter === 'A' ? 'sortDirA' : 'sortDirB';
  var currentDir = state[dirKey] || 'asc';
  var nextDir = currentDir === 'asc' ? 'desc' : 'asc';

  var patch = {};
  patch[dirKey] = nextDir;

  filled.sort(function (rowX, rowY) {
    var textX = ((letter === 'A' ? rowX.a : rowX.b) || '').toLowerCase();
    var textY = ((letter === 'A' ? rowY.a : rowY.b) || '').toLowerCase();

    if (textX === '' && textY !== '') return 1;
    if (textX !== '' && textY === '') return -1;
    if (textX === '' && textY === '') return 0;

    return textX.localeCompare(textY);
  });

  if (nextDir === 'desc') filled.reverse();

  filled.push({ a: '', b: '' });
  
  patch.rows = filled;
  window.setState(patch);

  if (typeof window.__gridRerender__ === 'function') {
    window.__gridRerender__();
  }
  if (typeof window.updateCharCount === 'function') {
    window.updateCharCount();
  }
  if (typeof window.syncStartTestButton === 'function') {
    window.syncStartTestButton();
  }
}

function initSorting() {
  var container = document.getElementById('spreadsheet-container');
  if (!container) return;

  container.querySelectorAll('.header-cell').forEach(function (headerEl) {
    var columnLetter = headerEl.dataset.col;
    var sortBtn = headerEl.querySelector('.header-sort-btn');

    if (sortBtn) {
      sortBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        sortSpreadsheetByColumn(columnLetter);
      });
    }
  });

  // Update sort button visuals based on state
  window.subscribe(function(state, prev) {
    if (state.sortDirA !== prev.sortDirA || state.sortDirB !== prev.sortDirB) {
      container.querySelectorAll('.header-cell').forEach(function(headerEl) {
        var col = headerEl.dataset.col;
        var dir = col === 'A' ? state.sortDirA : state.sortDirB;
        var btn = headerEl.querySelector('.header-sort-btn');
        if (btn) {
          btn.classList.remove('sort-asc', 'sort-desc');
          if (dir === 'asc') btn.classList.add('sort-asc');
          if (dir === 'desc') btn.classList.add('sort-desc');
        }
      });
    }
  });
}