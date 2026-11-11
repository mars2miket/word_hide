/**
 * speech-popups.js — classic script.
 * Playback menu popups (positioned above the menu button) and the voices modal.
 * Shared namespace: window.__speech__ (S)
 */
(function () {
  'use strict';
  var S = window.__speech__ = window.__speech__ || {};

  // ─── Popups ──────────────────────────────────────────────────────────────
  S.initPopups = function () {
    var menuBtn = S.menuBtn, menuPopup = S.menuPopup, speedSlider = S.speedSlider;
    var vModal = S.vModal, vSearch = S.vSearch, vSelect = S.vSelect, vClose = S.vClose;
    var voiceSelect = S.voiceSelect, voiceSearch = S.voiceSearch;
    if (!menuBtn || !menuPopup) return;
    
    var speedPopup = document.getElementById('m-speed-popup');
    var speedOpenBtn = document.getElementById('m-speed-open-btn');

    // Place a popup directly above the menu button
    function positionPopup(popup) {
      var r = menuBtn.getBoundingClientRect();
      var pw = popup.offsetWidth;
      var left = r.left + r.width / 2 - pw / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
      popup.style.right = 'auto';
      popup.style.left = left + 'px';
      popup.style.bottom = (window.innerHeight - r.top + 8) + 'px';
    }

    window.addEventListener('resize', function () { closeAll(); });

    function closeAll() {
      menuPopup.classList.remove('visible');
      menuPopup.hidden = true;
      if (speedPopup) {
        speedPopup.classList.remove('visible');
        speedPopup.hidden = true;
      }
    }

    // Main menu
    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var wasOpen = menuPopup.classList.contains('visible');
      closeAll();
      if (!wasOpen) {
        menuPopup.classList.add('visible');
        menuPopup.hidden = false;
        positionPopup(menuPopup);
      }
    });

    // Speed sub-menu
    if (speedOpenBtn && speedPopup) {
      speedOpenBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        menuPopup.classList.remove('visible');
        menuPopup.hidden = true;
        speedPopup.classList.add('visible');
        speedPopup.hidden = false;
        positionPopup(speedPopup);
      });

      // Speed preset buttons
      speedPopup.querySelectorAll('.speed-opt').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var val = parseFloat(btn.dataset.speed);
          speedSlider.value = val;
          speedSlider.dispatchEvent(new Event('input', { bubbles: true }));
          closeAll();
        });
      });
    }

    // Voices modal
    var vOpen = document.getElementById('m-voices-open-btn');
    if (vOpen && vModal && vSearch && vSelect && vClose) {
      function syncVoices() {
        vSelect.innerHTML = voiceSelect.innerHTML;
        vSelect.selectedIndex = voiceSelect.selectedIndex;
      }
      
      vOpen.addEventListener('click', function (e) {
        e.stopPropagation();
        closeAll();
        syncVoices();
        vModal.classList.add('visible');
        vModal.setAttribute('aria-hidden', 'false');
      });
      
      vSearch.addEventListener('input', function () {
        voiceSearch.value = vSearch.value;
        voiceSearch.dispatchEvent(new Event('input'));
        setTimeout(syncVoices, 250);
      });
      
      vSelect.addEventListener('change', function () {
        voiceSelect.selectedIndex = vSelect.selectedIndex;
        voiceSelect.dispatchEvent(new Event('change'));
      });
      
      vClose.addEventListener('click', function () {
        vModal.classList.remove('visible');
        vModal.setAttribute('aria-hidden', 'true');
      });
    }

    // Click outside closes popups
    document.addEventListener('click', function (e) {
      if (!menuPopup.contains(e.target) && e.target !== menuBtn &&
          (!speedPopup || (!speedPopup.contains(e.target) && e.target !== speedOpenBtn))) {
        closeAll();
      }
    });
  };

})();