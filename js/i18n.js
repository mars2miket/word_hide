/**
 * i18n.js — classic script.
 * -----------------------------------------------------------------------------
 * Loads locale dictionaries from window.__LOCALES__ and applies them to the DOM.
 * Exposes:
 *   window.__i18n__.t(key)        → translate a single key
 *   window.__i18n__.apply(code)   → translate all [data-i18n] DOM nodes
 *   window.__i18n__.get()         → current language code
 *   window.__i18n__.set(code)     → change language + apply
 *   window.__i18n__.codes         → ['en', 'vi', 'fr']
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var codes = ['en', 'vi', 'fr'];
  var fallback = 'en';
  var current = 'en';

  function dict() {
    return (window.__LOCALES__ && window.__LOCALES__[current]) || {};
  }
  function dictFallback() {
    return (window.__LOCALES__ && window.__LOCALES__[fallback]) || {};
  }

  function t(key) {
    if (!key) return '';
    var d = dict();
    if (d[key] !== undefined) return d[key];
    var fb = dictFallback();
    if (fb[key] !== undefined) return fb[key];
    return key; // last resort: return the key itself
  }

  function apply(code) {
    if (codes.indexOf(code) === -1) code = fallback;
    current = code;

    var root = document.documentElement;
    root.setAttribute('lang', code);
    root.setAttribute('data-lang', code);

    // Apply text nodes
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = t(key);
      if (val !== null && val !== undefined) el.textContent = val;
    });

    // Apply placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      var val = t(key);
      if (val !== null && val !== undefined) el.setAttribute('placeholder', val);
    });

    // Apply title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      var val = t(key);
      if (val !== null && val !== undefined) el.setAttribute('title', val);
    });
  }

  function get() {
    return current;
  }

  function set(code) {
    apply(code);
  }

  window.__i18n__ = {
    codes: codes,
    t: t,
    apply: apply,
    get: get,
    set: set
  };

  // Initial apply — prefer DOM's data-lang set by the pre-boot script, else state
  var initial = document.documentElement.getAttribute('data-lang');
  if (!initial || codes.indexOf(initial) === -1) {
    initial = (window.getState && window.getState().lang) || fallback;
  }
  apply(initial);
})();