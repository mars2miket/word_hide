/**
 * state.js — classic script.
 * -----------------------------------------------------------------------------
 * The single store. Every UI module reads from here and subscribes to changes.
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var listeners = new Set();

  var initialState = {
    // ─── UI / Chrome ─────────────────────────────────────────────────────
    theme: 'dark',
    lang: 'en',
    sidebarOpen: window.innerWidth > 700,
    viewMode: 'lists',              // 'lists' | 'notes' | 'analytics' | 'privacy'

    // ─── Grid / Deck Data ────────────────────────────────────────────────
    rows: [{ a: '', b: '' }],       // [{ a: '', b: '' }, ...]
    colHidden: { A: false, B: false },
    sortDirA: 'asc',
    sortDirB: 'asc',

    // ─── Lists ───────────────────────────────────────────────────────────
    lists: {},                      // { name: "raw text" }
    activeList: null,

    // ─── Notes ───────────────────────────────────────────────────────────
    notes: {},                      // { name: "raw text" }
    activeNote: null,
    noteActive: false,

    // ─── Speech ──────────────────────────────────────────────────────────
    isSpeaking: false,
    isPaused: false,
    isLooping: false,
    speed: 0.75,
    lastIndex: 0,
    voices: [],
    filteredVoices: [],
    selectedVoiceName: null,
    genderFilter: 'all',

    // ─── Exam ────────────────────────────────────────────────────────────
    examActive: false,
    examMode: 'choice',             // 'choice' | 'tf' | 'type'
    examReverse: false,             // false = A→B, true = B→A
    examDeck: [],
    examCounter: 0,
    examCorrect: 0,
    examAnswered: 0,

    // ─── Results / Analytics ─────────────────────────────────────────────
    examResults: []                 // [{ id, date, score, missed: [...] }]
  };

  var state = Object.assign({}, initialState);

  function getState() {
    return state;
  }

  function setState(patch) {
    var prev = state;
    state = Object.assign({}, state, patch);
    notify(prev);
  }

  function subscribe(fn) {
    listeners.add(fn);
    return function () { listeners.delete(fn); };
  }

  function notify(prev) {
    listeners.forEach(function (fn) {
      try {
        fn(state, prev);
      } catch (err) {
        console.error('[state] subscriber threw:', err);
      }
    });
  }

  function resetState() {
    var prev = state;
    state = Object.assign({}, initialState);
    notify(prev);
  }

  // Expose globally
  window.getState = getState;
  window.setState = setState;
  window.subscribe = subscribe;
  window.resetState = resetState;
  
  // Debug helper
  window.__vaultrecall_state__ = function () { return state; };
})();