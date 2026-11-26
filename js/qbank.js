/**
 * qbank.js — classic script.
 * Handles the Question Bank modal, CSV parsing, and deck generation.
 * Two-level navigation: Level 1 = files, Level 2 = categories in a file.
 */
(function () {
  'use strict';

  var CSV_URLS = ['banks/Business_Analysis.csv', 'banks/AI.csv', 'banks/Electric_Utility.csv',
    'banks/Cybersecurity.csv', 'banks/Prosci.csv'
   ];
  var DEFAULT_COUNT = 20;
  var USED_KEY = 'qbankUsed';
  var SEQ_KEY = 'qbankSeq';
  var WRONG_KEY = 'qbankWrong';
  var OPEN_KEY = 'qbankOpen';

  var data = null;          // { 'File Name': { category: [items] } }
  var view = 'files';       // 'files' | 'categories'
  var activeFile = null;
  var selected = null;      // { file, category } | null

  var overlay, searchEl, listEl, statusEl, rowEl, countEl, hintEl;
  var resetBtn, importBtn, titleEl, cancelBtn, countLabel;
  var headerEl, backBtn, fileNameEl;

  function t(key, fb) {
    var v = (window.__i18n__ && window.__i18n__.t) ? window.__i18n__.t(key) : null;
    return (v && v !== key) ? v : fb;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function hash(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  function clean(s) { return String(s || '').replace(/[\t\r\n]+/g, ' ').trim(); }

  function fileLabel(url) {
    return url.replace(/^.*\//, '').replace(/\.csv$/i, '').replace(/_/g, ' ').trim();
  }

  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var rows = [], row = [], field = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
        } else field += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = ''; rows.push(row); row = [];
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function buildData(text) {
    var rows = parseCSV(text);
    var out = {};
    rows.forEach(function (r, i) {
      var cat = clean(r[0]), q = clean(r[1]), a = clean(r[2]);
      if (i === 0 && cat.toLowerCase() === 'category') return;
      if (!cat || !q || !a) return;
      var w = [r[3], r[4], r[5]].map(clean).filter(Boolean);
      (out[cat] = out[cat] || []).push({
        q: q, a: a, w: w, id: hash(q.replace(/\s+/g, ' ').toLowerCase())
      });
    });
    return out;
  }

  function getUsedSet() {
    var arr = window.storage.get(USED_KEY, []) || [];
    var set = {};
    arr.forEach(function (id) { set[id] = 1; });
    return set;
  }
  function saveUsedSet(set) { window.storage.set(USED_KEY, Object.keys(set)); }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function leftIn(file, category, used) {
    return data[file][category].filter(function (i) { return !used[i.id]; }).length;
  }

  function fileTotals(file, used) {
    var left = 0, total = 0;
    Object.keys(data[file]).forEach(function (cat) {
      total += data[file][cat].length;
      left += leftIn(file, cat, used);
    });
    return { left: left, total: total };
  }

  // ─── DOM ─────────────────────────────────────────────────────────────────
  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function buildDom() {
    overlay = el('div', 'modal-overlay');
    overlay.id = 'qbank-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-hidden', 'true');

    var card = el('div', 'modal-card qbank-card');
    titleEl = el('h3', 'modal-title');

    headerEl = el('div', 'qbank-header');
    backBtn = el('button', 'qbank-back'); backBtn.type = 'button';
    fileNameEl = el('span', 'qbank-header-name');
    headerEl.appendChild(backBtn); headerEl.appendChild(fileNameEl);

    searchEl = el('input', 'ctrl-input');
    searchEl.type = 'text';
    searchEl.autocomplete = 'off';

    listEl = el('div', 'qbank-list');
    statusEl = el('div', 'qbank-status');

    rowEl = el('div', 'qbank-row');
    countLabel = el('label');
    countEl = el('input', 'ctrl-input');
    countEl.type = 'number';
    countEl.min = '1';
    countEl.inputMode = 'numeric';
    hintEl = el('span', 'qbank-hint');
    rowEl.appendChild(countLabel); rowEl.appendChild(countEl); rowEl.appendChild(hintEl);

    var actions = el('div', 'modal-actions');
    resetBtn = el('button', 'modal-btn'); resetBtn.type = 'button';
    cancelBtn = el('button', 'modal-btn'); cancelBtn.type = 'button';
    importBtn = el('button', 'modal-btn confirm'); importBtn.type = 'button';
    actions.appendChild(resetBtn); actions.appendChild(cancelBtn); actions.appendChild(importBtn);

    [titleEl, headerEl, searchEl, listEl, statusEl, rowEl, actions].forEach(function (n) { card.appendChild(n); });
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    searchEl.addEventListener('input', renderList);
    backBtn.addEventListener('click', goBack);
    cancelBtn.addEventListener('click', close);
    importBtn.addEventListener('click', doImport);
    resetBtn.addEventListener('click', doReset);
    countEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); doImport(); }
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) escape(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !overlay.classList.contains('visible')) return;
      var confirmEl = document.getElementById('confirm-modal');
      if (confirmEl && confirmEl.classList.contains('visible')) return;
      escape();
    });
  }

  function escape() {
    if (view === 'categories') goBack();
    else close();
  }

  function applyLabels() {
    titleEl.textContent = t('qbankTitle', 'Question Bank');
    searchEl.placeholder = view === 'files'
      ? t('qbankSearchFiles', 'Search...')
      : t('qbankSearch', 'Search categories...');
    backBtn.textContent = '\u2190 ' + t('qbankBack', 'Back');
    fileNameEl.textContent = activeFile || '';
    countLabel.textContent = t('qbankHowMany', 'Questions');
    resetBtn.textContent = t('qbankReset', 'Reset category');
    cancelBtn.textContent = t('cancel', 'Cancel');
    importBtn.textContent = t('qbankImport', 'Create list');
  }

  // ─── Rendering ───────────────────────────────────────────────────────────
  function renderList() {
    if (!data) return;
    if (view === 'files') renderFileList();
    else renderCategoryList(activeFile);
  }

  function appendNone() {
    var none = el('div', 'qbank-status');
    none.textContent = t('qbankNone', 'No categories found.');
    listEl.appendChild(none);
  }

  function renderFileList() {
    var keep = listEl.scrollTop;
    var q = searchEl.value.trim().toLowerCase();
    var used = getUsedSet();
    listEl.innerHTML = '';

    var files = Object.keys(data).sort(function (a, b) { return a.localeCompare(b); })
      .filter(function (n) { return !q || n.toLowerCase().indexOf(q) !== -1; });

    if (!files.length) appendNone();

    files.forEach(function (file) {
      var tot = fileTotals(file, used);
      var btn = el('button', 'qbank-item qbank-file');
      btn.type = 'button';
      btn.dataset.name = file;
      var n = el('span', 'qbank-item-name'); n.textContent = file;
      var c = el('span', 'qbank-item-count');
      c.textContent = t('qbankLeft', '{left} of {total} left')
        .replace('{left}', tot.left).replace('{total}', tot.total);
      btn.appendChild(n); btn.appendChild(c);
      btn.addEventListener('click', function () { enterFile(file); });
      listEl.appendChild(btn);
    });
    listEl.scrollTop = keep;
  }

  function renderCategoryList(file) {
    if (!file || !data[file]) return;
    var keep = listEl.scrollTop;
    var q = searchEl.value.trim().toLowerCase();
    var used = getUsedSet();
    listEl.innerHTML = '';

    var names = Object.keys(data[file]).sort(function (a, b) { return a.localeCompare(b); })
      .filter(function (n) { return !q || n.toLowerCase().indexOf(q) !== -1; });

    if (!names.length) appendNone();

    names.forEach(function (name) {
      var isSel = selected && selected.file === file && selected.category === name;
      var btn = el('button', 'qbank-item' + (isSel ? ' selected' : ''));
      btn.type = 'button';
      btn.dataset.name = name;
      var n = el('span', 'qbank-item-name'); n.textContent = name;
      var c = el('span', 'qbank-item-count');
      c.textContent = t('qbankLeft', '{left} of {total} left')
        .replace('{left}', leftIn(file, name, used)).replace('{total}', data[file][name].length);
      btn.appendChild(n); btn.appendChild(c);
      btn.addEventListener('click', function () { select(name); });
      listEl.appendChild(btn);
    });
    listEl.scrollTop = keep;
  }

  // ─── Navigation ──────────────────────────────────────────────────────────
  function enterFile(file) {
    view = 'categories';
    activeFile = file;
    selected = null;
    searchEl.value = '';
    listEl.scrollTop = 0;
    applyLabels();
    renderList();
    updateControls();
  }

  function goBack() {
    view = 'files';
    activeFile = null;
    selected = null;
    searchEl.value = '';
    listEl.scrollTop = 0;
    applyLabels();
    renderList();
    updateControls();
  }

  function select(name) {
    selected = { file: activeFile, category: name };
    listEl.querySelectorAll('.qbank-item').forEach(function (b) {
      b.classList.toggle('selected', b.dataset.name === name);
    });
    updateControls();
  }

  function updateControls() {
    var l2 = view === 'categories';
    headerEl.hidden = !l2;
    rowEl.hidden = !l2;
    importBtn.hidden = !l2;

    if (!l2) {
      resetBtn.hidden = true;
      if (data && Object.keys(data).length) statusEl.textContent = '';
      return;
    }

    if (!data || !selected || !data[selected.file] || !data[selected.file][selected.category]) {
      importBtn.disabled = true;
      resetBtn.hidden = true;
      countEl.disabled = true;
      hintEl.textContent = '';
      statusEl.textContent = t('qbankSelect', 'Select a category.');
      return;
    }
    var used = getUsedSet();
    var total = data[selected.file][selected.category].length;
    var left = leftIn(selected.file, selected.category, used);
    countEl.disabled = left === 0;
    countEl.max = String(left);
    importBtn.disabled = left === 0;
    resetBtn.hidden = (total - left) === 0;
    hintEl.textContent = left > 0 ? t('qbankUpTo', 'Up to {n} available').replace('{n}', left) : '';
    statusEl.textContent = left === 0 ? t('qbankAllUsed', 'All questions used. Reset to start over.') : '';
  }

  // ─── Open / close ────────────────────────────────────────────────────────
  function open() {
    window.storage.set(OPEN_KEY, true);
    if (!overlay) buildDom();
    data = null;
    view = 'files';
    activeFile = null;
    selected = null;
    applyLabels();
    searchEl.value = '';
    countEl.value = String(DEFAULT_COUNT);
    listEl.innerHTML = '';
    updateControls();
    statusEl.textContent = t('qbankLoading', 'Loading...');

    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');

    Promise.all(
      CSV_URLS.map(function (url) {
        return fetch(url, { cache: 'no-cache' })
          .then(function (r) { return r.ok ? r.text() : ''; })
          .catch(function () { return ''; });
      })
    )
    .then(function (texts) {
      var built = {};
      texts.forEach(function (text, i) {
        if (!text) return;
        var parsed = buildData(text);
        if (!Object.keys(parsed).length) return;
        built[fileLabel(CSV_URLS[i])] = parsed;
      });
      data = built;
    })
    .then(function () {
      if (!data || !Object.keys(data).length) {
        statusEl.textContent = t('qbankLoadErr', 'Could not load the question bank.');
        return;
      }
      renderList();
      updateControls();
      if (window.matchMedia('(hover: hover)').matches) searchEl.focus();
    });
  }

  function close() {
    window.storage.set(OPEN_KEY, false);
    if (overlay) {
      overlay.classList.remove('visible');
      overlay.setAttribute('aria-hidden', 'true');
    }
  }

  // ─── Actions ─────────────────────────────────────────────────────────────
  function doReset() {
    if (!selected) return;
    var file = selected.file;
    var category = selected.category;
    var run = function () {
      var used = getUsedSet();
      data[file][category].forEach(function (i) { delete used[i.id]; });
      saveUsedSet(used);
      renderList();
      updateControls();
    };
    if (typeof window.showConfirm === 'function') {
      window.showConfirm(
        t('qbankReset', 'Reset category'),
        t('qbankResetConfirm', 'Reset "{name}"? Used questions can appear again.').replace('{name}', category),
        t('confirm', 'Confirm'),
        run
      );
    } else run();
  }

  function doImport() {
    if (!selected || !data || !data[selected.file] || !data[selected.file][selected.category]) return;
    var category = selected.category;
    var used = getUsedSet();
    var pool = data[selected.file][category].filter(function (i) { return !used[i.id]; });
    var n = parseInt(countEl.value, 10);
    if (!(n > 0)) n = DEFAULT_COUNT;
    n = Math.min(n, pool.length);
    if (n < 1) return;

    var picked = shuffle(pool.slice()).slice(0, n);
    var st = window.getState();
    var lists = Object.assign({}, st.lists);

    if (st.activeList && typeof window.serializeGrid === 'function') {
      lists[st.activeList] = window.serializeGrid();
    }

    var seq = window.storage.get(SEQ_KEY, {}) || {};
    var num = (seq[category] || 0) + 1;
    var name = category + ' #' + num + ' (' + n + ')';

    while (name in lists) { num++; name = category + ' #' + num + ' (' + n + ')'; }
    seq[category] = num;

    window.storage.set(SEQ_KEY, seq);

    lists[name] = picked.map(function (i) { return i.q + '\t' + i.a; }).join('\n');
    picked.forEach(function (i) { used[i.id] = 1; });

    var wrong = window.storage.get(WRONG_KEY, {}) || {};
    picked.forEach(function (i) { if (i.w && i.w.length) wrong[i.id] = i.w; });

    window.storage.set(WRONG_KEY, wrong);
    saveUsedSet(used);

    window.setState({
      lists: lists,
      activeList: name,
      rows: window.parseList(lists[name])
    });

    if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
    if (typeof window.updateCharCount === 'function') window.updateCharCount();
    if (typeof window.syncStartTestButton === 'function') window.syncStartTestButton();

    close();
  }

  // ─── Init ────────────────────────────────────────────────────────────────
  function initQbank() {
    var btn = document.getElementById('qbank-open-btn');
    if (btn) btn.addEventListener('click', open);

    // Keep labels in the current language while the modal is open
    window.addEventListener('language-changed', function () {
      if (!overlay) return;
      applyLabels();
      renderList();
      updateControls();
    });
  }

  window.qbankWrongFor = function (prompt) {
    var map = window.storage.get(WRONG_KEY, {}) || {};
    var w = map[hash(String(prompt || '').replace(/\s+/g, ' ').trim().toLowerCase())];
    return (w && w.length) ? w : null;
  };

  window.initQbank = initQbank;
})();