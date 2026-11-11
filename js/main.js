(function () {
  'use strict';

  function boot() {
    var initOrder = [
      'initModal', 
      'initNav', 
      'initGrid', 
      'initSorting',       // <-- Added
      'initDuplicates',    // <-- Added
      'initLists', 
      'initQbank', 
      'initNotes', 
      'initSpeech', 
      'initExam', 
      'initAnalytics', 
      'initWorkspaceToggle', 
      'initOnboarding'
    ];

        // 1. Hydrate state from storage
    if (window.storage && window.setState) {
      var saved = {
        theme: window.storage.get('theme', 'dark'),
        lang: window.storage.get('lang', 'en'),
        rows: window.storage.get('rows', [{a:'',b:''}]),
        lists: window.storage.get('lists', {}),
        activeList: window.storage.get('activeList', null),
        notes: window.storage.get('notes', {}),
        activeNote: window.storage.get('activeNote', null),
        speed: window.storage.get('speed', 0.75),
        selectedVoiceName: window.storage.get('voiceName', null),
        examMode: window.storage.get('examMode', 'choice'),
        examReverse: window.storage.get('examReverse', false),
        viewMode: window.storage.get('viewMode', 'lists'),
        sidebarOpen: window.storage.get('sidebarOpen', window.innerWidth > 700)
      };
      window.setState(saved);
    }
    
    initOrder.forEach(function (fn) {
      if (typeof window[fn] === 'function') {
        try { 
          window[fn](); 
        } catch (e) { 
          console.error('[Boot]', fn, 'failed:', e); 
        }
      } else {
        console.warn('[Boot] Missing init function:', fn);
      }
    });

    // Global persistence subscriber (moved from old main.js)
    if (window.subscribe && window.storage) {
      var PERSISTED_KEYS = {
        theme: 'theme',
        lang: 'lang',
        rows: 'rows',
        lists: 'lists',
        activeList: 'activeList',
        notes: 'notes',
        activeNote: 'activeNote',
        speed: 'speed',
        selectedVoiceName: 'voiceName',
        examMode: 'examMode',
        examReverse: 'examReverse',
        viewMode: 'viewMode',
        sidebarOpen: 'sidebarOpen'
      };

      window.subscribe(function (state, prev) {
        Object.keys(PERSISTED_KEYS).forEach(function (stateKey) {
          if (state[stateKey] !== prev[stateKey]) {
            window.storage.set(PERSISTED_KEYS[stateKey], state[stateKey]);
          }
        });
      });
    }
  }

  // Since main.js is loaded at the end of the body, DOM is ready.
  // But if it's moved to <head>, wait for DOMContentLoaded.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();