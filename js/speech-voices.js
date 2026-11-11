/**
 * speech-voices.js — classic script.
 * Voice list, search filter and selection.
 * Shared namespace: window.__speech__ (S)
 */
(function () {
  'use strict';
  var S = window.__speech__ = window.__speech__ || {};

  S.allVoices = [];
  S.filteredVoices = [];

  S.populateVoices = function () {
    S.allVoices = S.synth.getVoices();
    if (S.allVoices.length === 0) return;

    S.allVoices.sort(function (a, b) { return a.name.localeCompare(b.name); });

    var query = (S.voiceSearch && S.voiceSearch.value || '').toLowerCase().trim();

    S.filteredVoices = S.allVoices.filter(function (v) {
      return ((v.name + ' ' + v.lang).toLowerCase().indexOf(query) !== -1);
    });

    if (!S.voiceSelect) return;
    S.voiceSelect.innerHTML = '';

    var savedName = window.getState().selectedVoiceName;
    var targetIdx = 0;

    S.filteredVoices.forEach(function (voice, i) {
      var op = document.createElement('option');
      op.value = i;
      op.textContent = voice.name + ' (' + voice.lang + ')';
      if (savedName === voice.name) targetIdx = i;
      S.voiceSelect.appendChild(op);
    });

    if (S.filteredVoices.length > 0) {
      S.voiceSelect.selectedIndex = targetIdx;
      window.setState({ selectedVoiceName: S.filteredVoices[targetIdx].name });
    } else {
      var empty = document.createElement('option');
      empty.textContent = 'No matches found';
      S.voiceSelect.appendChild(empty);
    }

    window.setState({ voices: S.allVoices, filteredVoices: S.filteredVoices });
  };

  S.onVoiceSelectChange = function () {
    var idx = parseInt(S.voiceSelect.value, 10);
    if (S.filteredVoices[idx]) {
      window.setState({ selectedVoiceName: S.filteredVoices[idx].name });
    }
  };

  S.initVoices = function () {
    S.populateVoices();
    if (S.synth.onvoiceschanged !== undefined) {
      S.synth.onvoiceschanged = S.populateVoices;
    }
    if (S.voiceSearch) {
      var searchDebounce;
      S.voiceSearch.addEventListener('input', function () {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(S.populateVoices, 150);
      });
    }
    if (S.voiceSelect) S.voiceSelect.addEventListener('change', S.onVoiceSelectChange);
  };

})();