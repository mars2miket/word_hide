/**
 * cloud-sync.js — classic script.
 * Hybrid storage router: keeps localStorage untouched for guests and syncs
 * lists, list_rows, notes, and test_results to Supabase when logged in.
 */
(function () {
  'use strict';

  var client = window.supabaseClient;
  var currentUser = null;
  var isHydrating = false;

  var listIds = {};
  var listTimers = {};
  var pendingLists = {};

  var noteIds = {};
  var noteTimers = {};
  var pendingNotes = {};

  var RESULTS_KEY = '__TEST_RESULTS__';
  var DEBOUNCE_MS = 900;
  var QUERY_TIMEOUT_MS = 10000;

  var cloudTestResults = [];
  var bannerEl = null;

  function t(key) {
    return (window.__i18n__ && window.__i18n__.t) ? window.__i18n__.t(key) : key;
  }

  // ─── Banner / Resilience UI ──────────────────────────────────────────────
  function showSyncBanner(msg, isError) {
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'cloud-sync-banner';
      bannerEl.setAttribute('role', 'status');
      bannerEl.setAttribute('aria-live', 'polite');

      var textSpan = document.createElement('span');
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Dismiss');
      closeBtn.textContent = '\u00D7';
      closeBtn.addEventListener('click', hideSyncBanner);

      bannerEl.appendChild(textSpan);
      bannerEl.appendChild(closeBtn);
      document.body.appendChild(bannerEl);
    }

    bannerEl.classList.toggle('is-error', !!isError);
    var span = bannerEl.querySelector('span');
    if (span) {
      span.textContent = String(msg || '');
    }
    bannerEl.style.display = 'flex';
  }

  function hideSyncBanner() {
    if (bannerEl) bannerEl.style.display = 'none';
  }

  // ─── Timeout & Retry Wrapper ─────────────────────────────────────────────
  function withTimeout(promiseFactory, retries) {
    retries = retries || 0;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error('CLOUD_TIMEOUT'));
      }, QUERY_TIMEOUT_MS);

      promiseFactory().then(function (res) {
        clearTimeout(timer);
        if (res && res.error) {
          reject(res.error);
        } else {
          hideSyncBanner();
          resolve(res);
        }
      }).catch(function (err) {
        clearTimeout(timer);
        if (retries > 0) {
          showSyncBanner(t('cloudSyncRetrying'), false);
          setTimeout(function () {
            withTimeout(promiseFactory, retries - 1).then(resolve).catch(reject);
          }, 2500);
        } else {
          reject(err);
        }
      });
    });
  }

  function handleQueryError(err, context) {
    console.error('[CloudSync]', context, err);
    var msg = (err && (err.message || err.code)) || '';
    if (String(msg).indexOf('JWT') !== -1 || (err && err.status === 401)) {
      showSyncBanner(t('cloudSyncExpired'), true);
      currentUser = null;
      updateStorageBadges();
      return;
    }
    showSyncBanner(t('cloudSyncDelayed') + ' (' + context + ')', true);
  }

  // ─── Status Badge Helper ─────────────────────────────────────────────────
  function updateStorageBadges() {
    var isCloud = !!currentUser;
    document.querySelectorAll('[data-storage-badge]').forEach(function (el) {
      el.textContent = isCloud ? t('storageCloud') : t('storageLocal');
      el.classList.toggle('is-cloud', isCloud);
    });
    var signInBtn = document.getElementById('cloud-signin-open-btn');
    if (signInBtn) {
      signInBtn.style.display = isCloud ? 'none' : 'inline-flex';
    }
    var signOutBtn = document.getElementById('role-signout');
    if (signOutBtn && isCloud) {
      signOutBtn.style.display = 'block';
    }
    var accBtn = document.getElementById('account-toggle');
    if (accBtn) {
      accBtn.classList.toggle('signed-in', isCloud || !!window.storage.get('accountRole', null));
    }
  }

  // ─── Hydration from Supabase ─────────────────────────────────────────────
  async function hydrateFromCloud(user) {
    if (!client || !user) return;
    currentUser = user;
    updateStorageBadges();
    showSyncBanner(t('cloudSyncSyncing'), false);

    try {
      var listsRes = await withTimeout(function () {
        return client.from('decks').select('id, name, updated_at').eq('user_id', user.id);
      }, 2);

      var rowsRes = await withTimeout(function () {
        return client.from('list_rows').select('id, list_id, a, b, row_order').eq('user_id', user.id).order('row_order', { ascending: true });
      }, 1);

      var notesRes = await withTimeout(function () {
        return client.from('notes').select('id, title, content, updated_at').eq('user_id', user.id);
      }, 1);

      var testsRes = await withTimeout(function () {
        return client.from('test_results').select('*').eq('user_id', user.id).order('taken_at', { ascending: false });
      }, 1);

      var remoteLists = listsRes.data || [];
      var remoteRows = rowsRes.data || [];
      var remoteNotes = notesRes.data || [];
      cloudTestResults = testsRes.data || [];

      var localLists = window.storage.get('lists', {});
      var localNotes = window.storage.get('notes', {});
      var hasLocalData = Object.keys(localLists).some(function (k) { return (localLists[k] || '').trim(); }) ||
                         Object.keys(localNotes).some(function (k) { return k !== RESULTS_KEY && k !== '__DEFAULT_NOTE__' && (localNotes[k] || '').trim(); });

      if (remoteLists.length === 0 && remoteNotes.length === 0 && hasLocalData) {
        hideSyncBanner();
        var shouldImport = await askMigrationPrompt();
        if (shouldImport) {
          await migrateLocalToCloud(localLists, localNotes);
          return hydrateFromCloud(user);
        }
      }

      var rowsByListId = {};
      remoteRows.forEach(function (r) {
        if (!rowsByListId[r.list_id]) rowsByListId[r.list_id] = [];
        rowsByListId[r.list_id].push((r.a || '') + '\t' + (r.b || ''));
      });

      listIds = {};
      var hydratedLists = {};
      var defaultListLabel = (typeof window.getDisplayName === 'function')
        ? window.getDisplayName('__DEFAULT_LIST__', 'lists')
        : '__DEFAULT_LIST__';
      remoteLists.forEach(function (l) {
        var internalName = (l.name === defaultListLabel) ? '__DEFAULT_LIST__' : l.name;
        listIds[internalName] = l.id;
        hydratedLists[internalName] = (rowsByListId[l.id] || []).join('\n');
      });

      if (Object.keys(hydratedLists).length === 0) {
        hydratedLists['__DEFAULT_LIST__'] = '';
      }

      noteIds = {};
      var hydratedNotes = {};
      remoteNotes.forEach(function (n) {
        if (n.title === RESULTS_KEY) return;
        noteIds[n.title] = n.id;
        hydratedNotes[n.title] = n.content || '';
      });

      if (Object.keys(hydratedNotes).length === 0) {
        hydratedNotes['__DEFAULT_NOTE__'] = 'Click Play to hear your notes read aloud.';
      }

      var currentSt = window.getState();
      var nextActiveList = (currentSt.activeList && currentSt.activeList in hydratedLists)
        ? currentSt.activeList
        : Object.keys(hydratedLists)[0];
      var nextActiveNote = (currentSt.activeNote && currentSt.activeNote in hydratedNotes)
        ? currentSt.activeNote
        : Object.keys(hydratedNotes)[0];

      isHydrating = true;
      window.setState({
        lists: hydratedLists,
        activeList: nextActiveList,
        rows: window.parseList ? window.parseList(hydratedLists[nextActiveList]) : [{ a: '', b: '' }],
        notes: hydratedNotes,
        activeNote: nextActiveNote
      });
      isHydrating = false;

      if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
      if (typeof window.updateCharCount === 'function') window.updateCharCount();
      if (typeof window.syncStartTestButton === 'function') window.syncStartTestButton();
      window.dispatchEvent(new Event('cloud-hydrated'));
      hideSyncBanner();
    } catch (err) {
      isHydrating = false;
      handleQueryError(err, 'initial sync');
    }
  }

  function askMigrationPrompt() {
    return new Promise(function (resolve) {
      if (typeof window.showConfirm === 'function') {
        window.showConfirm(
          t('cloudImportTitle'),
          t('cloudImportBody'),
          t('cloudImportBtn'),
          function () { resolve(true); }
        );
        var cancelBtn = document.getElementById('confirm-cancel');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', function onCancel() {
            cancelBtn.removeEventListener('click', onCancel);
            resolve(false);
          });
        }
      } else {
        resolve(window.confirm(t('cloudImportBody')));
      }
    });
  }

  async function migrateLocalToCloud(localLists, localNotes) {
    showSyncBanner(t('cloudSyncImporting'), false);
    var lKeys = Object.keys(localLists || {});
    for (var i = 0; i < lKeys.length; i++) {
      await upsertListNow(lKeys[i], localLists[lKeys[i]]);
    }
    var nKeys = Object.keys(localNotes || {});
    for (var j = 0; j < nKeys.length; j++) {
      if (nKeys[j] !== RESULTS_KEY) {
        await upsertNoteNow(nKeys[j], localNotes[nKeys[j]]);
      }
    }
  }

  // ─── Debounced List & Note Sync ──────────────────────────────────────────
  function scheduleListSync(listName, serializedText) {
    if (!currentUser || isHydrating || !listName) return;
    pendingLists[listName] = serializedText;
    clearTimeout(listTimers[listName]);
    listTimers[listName] = setTimeout(function () {
      var payload = pendingLists[listName];
      delete pendingLists[listName];
      delete listTimers[listName];
      upsertListNow(listName, payload);
    }, DEBOUNCE_MS);
  }

  async function upsertListNow(listName, serializedText) {
    if (!client || !currentUser || !listName) return;
    if (listName.length > 200) {
      showSyncBanner(t('cloudSyncDeckTitleTooLong'), true);
      return;
    }

    try {
      var cloudName = (listName === '__DEFAULT_LIST__' && typeof window.getDisplayName === 'function')
        ? window.getDisplayName('__DEFAULT_LIST__', 'lists')
        : listName;
      var listRes = await withTimeout(function () {
        return client
          .from('decks')
          .upsert({
            user_id: currentUser.id,
            name: cloudName,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,name' })
          .select('id')
          .single();
      }, 1);

      var listId = listRes.data && listRes.data.id;
      if (!listId) return;
      listIds[listName] = listId;

      var parsed = window.parseList ? window.parseList(serializedText) : [];
      var cleanRows = parsed.filter(function (r) {
        return (r.a && r.a.trim()) || (r.b && r.b.trim());
      });

      for (var i = 0; i < cleanRows.length; i++) {
        if ((cleanRows[i].a || '').length > 2000 || (cleanRows[i].b || '').length > 2000) {
          showSyncBanner(t('cloudSyncRowTooLong').replace('{n}', i + 1), true);
          return;
        }
      }

      await withTimeout(function () {
        return client.from('list_rows').delete().eq('list_id', listId).eq('user_id', currentUser.id);
      }, 1);

      if (cleanRows.length > 0) {
        var insertPayload = cleanRows.map(function (r, idx) {
          return {
            list_id: listId,
            user_id: currentUser.id,
            a: r.a || '',
            b: r.b || '',
            row_order: idx
          };
        });
        await withTimeout(function () {
          return client.from('list_rows').insert(insertPayload);
        }, 1);
      }
    } catch (err) {
      handleQueryError(err, 'saving deck "' + listName + '"');
    }
  }

  async function deleteListCloud(listName) {
    if (!client || !currentUser || !listName) return;
    clearTimeout(listTimers[listName]);
    delete pendingLists[listName];
    var cloudName = (listName === '__DEFAULT_LIST__' && typeof window.getDisplayName === 'function')
      ? window.getDisplayName('__DEFAULT_LIST__', 'lists')
      : listName;
    try {
      await withTimeout(function () {
        return client.from('decks').delete().eq('user_id', currentUser.id).eq('name', cloudName);
      }, 1);
      delete listIds[listName];
    } catch (err) {
      handleQueryError(err, 'deleting deck');
    }
  }

  function scheduleNoteSync(title, content) {
    if (!currentUser || isHydrating || !title || title === RESULTS_KEY) return;
    pendingNotes[title] = content;
    clearTimeout(noteTimers[title]);
    noteTimers[title] = setTimeout(function () {
      var payload = pendingNotes[title];
      delete pendingNotes[title];
      delete noteTimers[title];
      upsertNoteNow(title, payload);
    }, DEBOUNCE_MS);
  }

  async function upsertNoteNow(title, content) {
    if (!client || !currentUser || !title || title === RESULTS_KEY) return;
    if (title.length > 200 || (content || '').length > 15000) {
      showSyncBanner(t('cloudSyncNoteTooLong'), true);
      return;
    }
    try {
      var res = await withTimeout(function () {
        return client
          .from('notes')
          .upsert({
            user_id: currentUser.id,
            title: title,
            content: content || '',
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,title' })
          .select('id')
          .single();
      }, 1);
      if (res.data && res.data.id) noteIds[title] = res.data.id;
    } catch (err) {
      handleQueryError(err, 'saving note "' + title + '"');
    }
  }

  async function deleteNoteCloud(title) {
    if (!client || !currentUser || !title || title === RESULTS_KEY) return;
    clearTimeout(noteTimers[title]);
    delete pendingNotes[title];
    try {
      await withTimeout(function () {
        return client.from('notes').delete().eq('user_id', currentUser.id).eq('title', title);
      }, 1);
      delete noteIds[title];
    } catch (err) {
      handleQueryError(err, 'deleting note');
    }
  }

  // ─── Test Results (Exam & Analytics) ─────────────────────────────────────
  async function saveTestResultCloud(payload) {
    if (!client || !currentUser) return false;
    try {
      var row = {
        user_id: currentUser.id,
        test_title: payload.test_title || 'Untitled',
        test_mode: payload.test_mode || 'choice',
        correct_count: payload.correct_count || 0,
        total_questions: payload.total_questions || 0,
        score_pct: payload.score_pct || 0,
        missed_items: payload.missed_items || [],
        taken_at: new Date().toISOString()
      };
      var res = await withTimeout(function () {
        return client.from('test_results').insert(row).select('*').single();
      }, 1);
      if (res.data) cloudTestResults.unshift(res.data);
      return true;
    } catch (err) {
      handleQueryError(err, 'saving exam result');
      return false;
    }
  }

  function getTestResultsCloud() {
    return cloudTestResults.slice();
  }

  // ─── Flush on Tab Close / Sign-Out ───────────────────────────────────────
  async function flushPending() {
    var tasks = [];
    Object.keys(pendingLists).forEach(function (name) {
      clearTimeout(listTimers[name]);
      var text = pendingLists[name];
      delete pendingLists[name];
      delete listTimers[name];
      tasks.push(upsertListNow(name, text));
    });
    Object.keys(pendingNotes).forEach(function (title) {
      clearTimeout(noteTimers[title]);
      var content = pendingNotes[title];
      delete pendingNotes[title];
      delete noteTimers[title];
      tasks.push(upsertNoteNow(title, content));
    });
    if (tasks.length) await Promise.allSettled(tasks);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && currentUser) flushPending();
  });
  window.addEventListener('beforeunload', function () {
    if (currentUser) flushPending();
  });

  // ─── State Diff Watcher ──────────────────────────────────────────────────
  function bindStateSync() {
    if (!window.subscribe) return;

    window.subscribe(function (state, prev) {
      if (!currentUser || isHydrating) return;

      if (state.rows !== prev.rows && state.activeList) {
        var serialized = typeof window.serializeGrid === 'function' ? window.serializeGrid() : '';
        scheduleListSync(state.activeList, serialized);
      }

      if (state.lists !== prev.lists) {
        var prevKeys = Object.keys(prev.lists || {});
        var nextKeys = Object.keys(state.lists || {});

        prevKeys.forEach(function (k) {
          if (!(k in state.lists)) deleteListCloud(k);
        });

        nextKeys.forEach(function (k) {
          if (!(k in prev.lists) || state.lists[k] !== prev.lists[k]) {
            scheduleListSync(k, state.lists[k]);
          }
        });
      }

      if (state.notes !== prev.notes) {
        var prevNoteKeys = Object.keys(prev.notes || {});
        var nextNoteKeys = Object.keys(state.notes || {});

        prevNoteKeys.forEach(function (k) {
          if (!(k in state.notes)) deleteNoteCloud(k);
        });

        nextNoteKeys.forEach(function (k) {
          if (k !== RESULTS_KEY && (!(k in prev.notes) || state.notes[k] !== prev.notes[k])) {
            scheduleNoteSync(k, state.notes[k]);
          }
        });
      }
    });
  }

  // ─── Auth Actions & Boot ─────────────────────────────────────────────────
  async function signIn(email, password, captchaToken) {
    if (!client) throw new Error('Supabase client is not configured.');
    var opts = { email: email, password: password };
    if (captchaToken) opts.options = { captchaToken: captchaToken };
    var res = await client.auth.signInWithPassword(opts);
    if (res.error) throw res.error;
    return res.data;
  }

  async function signOut() {
    if (!client) return;
    await flushPending();
    await client.auth.signOut();
    currentUser = null;
    listIds = {};
    noteIds = {};
    cloudTestResults = [];
    updateStorageBadges();

    var localLists = window.storage.get('lists', { '__DEFAULT_LIST__': '' });
    var localActiveList = window.storage.get('activeList', Object.keys(localLists)[0]);
    var localNotes = window.storage.get('notes', { '__DEFAULT_NOTE__': 'Click Play to hear your notes read aloud.' });
    var localActiveNote = window.storage.get('activeNote', Object.keys(localNotes)[0]);

    isHydrating = true;
    window.setState({
      lists: localLists,
      activeList: localActiveList,
      rows: window.parseList ? window.parseList(localLists[localActiveList]) : [{ a: '', b: '' }],
      notes: localNotes,
      activeNote: localActiveNote
    });
    isHydrating = false;

    if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
    if (typeof window.updateCharCount === 'function') window.updateCharCount();
    if (typeof window.syncStartTestButton === 'function') window.syncStartTestButton();
  }

  async function initCloudSync() {
    bindStateSync();
    updateStorageBadges();
    if (!client) return;

    client.auth.onAuthStateChange(function (event, session) {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && session.user) {
        if (!currentUser || currentUser.id !== session.user.id) {
          hydrateFromCloud(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        updateStorageBadges();
      }
    });

    try {
      var sessionRes = await client.auth.getSession();
      if (sessionRes && sessionRes.data && sessionRes.data.session && sessionRes.data.session.user) {
        await hydrateFromCloud(sessionRes.data.session.user);
      }
    } catch (err) {
      handleQueryError(err, 'session check');
    }
  }

  window.cloudSync = {
    isAuthenticated: function () { return !!currentUser; },
    getUser: function () { return currentUser; },
    signIn: signIn,
    signOut: signOut,
    flushPending: flushPending,
    saveTestResult: saveTestResultCloud,
    getTestResults: getTestResultsCloud,
    updateStorageBadges: updateStorageBadges
  };

  window.initCloudSync = initCloudSync;
})();