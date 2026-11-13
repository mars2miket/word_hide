/**
 * onboarding.js — classic script.
 * Handles first-run sample data and the hint card.
 */
(function () {
  'use strict';

  var SAMPLE_DATA = {
    en: [
      ["hello", "xin chào"],
      ["thank you", "cảm ơn"],
      ["goodbye", "tạm biệt"],
      ["student", "học sinh"],
      ["teacher", "giáo viên"]
    ],
    vi: [
      ["xin chào", "hello"],
      ["cảm ơn", "thank you"],
      ["tạm biệt", "goodbye"],
      ["học sinh", "student"],
      ["giáo viên", "teacher"]
    ]
  };

  function initOnboarding() {
    seedSampleData();
    initHintCard();
  }

  // ─── Sample data seed ────────────────────────────────────────────────────
  function seedSampleData() {
    try {
      if (window.storage.get('onboarded')) return;

      var existingRows = window.getState().rows || [];
      var hasRealData = existingRows.some(function (r) {
        return (r.a && r.a.trim()) || (r.b && r.b.trim());
      });
      
      if (hasRealData) {
        window.storage.set('onboarded', true);
        return;
      }

      var lang = document.documentElement.getAttribute('data-lang') || 'en';
      var sample = SAMPLE_DATA[lang] || SAMPLE_DATA.en;

      var rows = sample.map(function (pair) {
        return { a: pair[0] || '', b: pair[1] || '' };
      });

            // Update state directly. main.js will persist it via the subscriber.
      window.setState({ rows: rows });
      window.storage.set('onboarded', true);

      if (typeof window.__gridRerender__ === 'function') {
        window.__gridRerender__();
      }
    } catch (err) {
      console.warn('[onboarding] seed failed:', err);
    }
  }

    // ─── Hint card ───────────────────────────────────────────────────────────
  function initHintCard() {
    var hint = document.getElementById('onboarding-hint');
    if (!hint) return;

    var hintHTML = hint.outerHTML;
    var hintParent = hint.parentNode;
    var anchor = hintParent.querySelector('.view-switch');

    function applyHintVisibility() {
      var dismissed = !!window.storage.get('hintDismissed');
      var existing = document.getElementById('onboarding-hint');

      if (dismissed && existing) {
        existing.remove();
      } else if (!dismissed && !existing) {
        var temp = document.createElement('div');
        temp.innerHTML = hintHTML;
        var fresh = temp.firstElementChild;
        if (anchor && anchor.parentNode === hintParent) {
          hintParent.insertBefore(fresh, anchor);
        } else {
          hintParent.appendChild(fresh);
        }
        if (window.__i18n__ && window.__i18n__.apply) {
          window.__i18n__.apply(window.__i18n__.get());
        }
      }
    }

    // Event Delegation: catch the click on the parent container
    hintParent.addEventListener('click', function(e) {
      if (e.target && e.target.id === 'onboarding-dismiss') {
        var currentHint = document.getElementById('onboarding-hint');
        if (currentHint) currentHint.remove();
        window.storage.set('hintDismissed', true);
      }
    });

    window.__onboardingShow__ = applyHintVisibility;
    applyHintVisibility();
  }

  window.initOnboarding = initOnboarding;
})();