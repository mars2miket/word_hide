/**
 * storage.js — classic script.
 * -----------------------------------------------------------------------------
 * Single source of truth for all localStorage access.
 * Namespaces keys under "vault-recall:".
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var PREFIX = 'vault-recall:';

  var storage = {
    get: function (key, fallback) {
      if (fallback === undefined) fallback = null;
      try {
        var raw = localStorage.getItem(PREFIX + key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
      } catch (err) {
        console.warn('[storage] failed to read "' + key + '":', err);
        return fallback;
      }
    },

    set: function (key, value) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch (err) {
        console.warn('[storage] failed to write "' + key + '":', err);
        return false;
      }
    },

    remove: function (key) {
      try {
        localStorage.removeItem(PREFIX + key);
      } catch (err) {
        console.warn('[storage] failed to remove "' + key + '":', err);
      }
    },

    clear: function () {
      try {
        Object.keys(localStorage)
          .filter(function (k) { return k.indexOf(PREFIX) === 0; })
          .forEach(function (k) { localStorage.removeItem(k); });
      } catch (err) {
        console.warn('[storage] clear failed:', err);
      }
    }
  };

  // Expose globally
  window.storage = storage;
})();