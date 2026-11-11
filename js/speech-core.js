/**
 * speech-core.js — classic script.
 * Entry point: grabs DOM refs and wires voices, controls and popups. Load LAST.
 * Shared namespace: window.__speech__ (S)
 */
(function () {
  'use strict';
  var S = window.__speech__ = window.__speech__ || {};

  function initSpeech() {
    S.synth       = window.speechSynthesis;
    S.readBtn     = document.getElementById('m-read-btn');
    S.stopBtn     = document.getElementById('m-stop-btn');
    S.rewindBtn   = document.getElementById('m-rewind-btn');
    S.forwardBtn  = document.getElementById('m-forward-btn');
    S.loopCheck   = document.getElementById('m-loop-check');

    // Hidden controls
    S.speedSlider = document.getElementById('speed-slider');
    S.speedValue  = document.getElementById('speed-value');
    S.voiceSearch = document.getElementById('voice-search');
    S.voiceSelect = document.getElementById('voice-select');

    // Menu & popups
    S.menuBtn     = document.getElementById('m-menu-btn');
    S.menuPopup   = document.getElementById('m-menu-popup');
    S.speedOpenBtn = document.getElementById('m-speed-open-btn');
    S.speedPopup  = document.getElementById('m-speed-popup');

    // Voices modal
    S.vOpen       = document.getElementById('m-voices-open-btn');
    S.vModal      = document.getElementById('voices-modal');
    S.vSearch     = document.getElementById('vm-search');
    S.vSelect     = document.getElementById('vm-select');
    S.vClose      = document.getElementById('vm-close');

    if (!S.synth) {
      console.warn('[speech] SpeechSynthesis not supported');
      return;
    }

    S.initVoices();
    S.initControls();
    S.initPopups();
  }

  window.initSpeech = initSpeech;
})();