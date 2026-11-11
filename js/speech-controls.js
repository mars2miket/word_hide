/**
 * speech-controls.js — classic script.
 * Read / stop / loop / seek / speed handlers and button visuals.
 * Shared namespace: window.__speech__ (S)
 */
(function () {
  'use strict';
  var S = window.__speech__ = window.__speech__ || {};

  var SEEK_WORD_COUNT = 5;

  S.setPlayButtonState = function (state) {
    if (!S.readBtn) return;
    S.readBtn.classList.toggle('is-playing', state === 'playing');
    if (state === 'playing') S.readBtn.setAttribute('aria-label', 'Pause');
    else if (state === 'paused') S.readBtn.setAttribute('aria-label', 'Resume');
    else S.readBtn.setAttribute('aria-label', 'Read');
  };

  S.setLoopVisual = function (enabled) {
    if (!S.loopCheck) return;
    S.loopCheck.classList.toggle('loop-on', enabled);
    S.loopCheck.classList.toggle('loop-off', !enabled);
    S.loopCheck.setAttribute('aria-label', enabled ? 'Loop on' : 'Loop off');
  };

  S.handleReadClick = function () {
    if (S.allVoices.length === 0) S.populateVoices();
    if (S.allVoices.length === 0) {
      S.setPlayButtonState('idle');
      setTimeout(function () {
        S.populateVoices();
        if (S.allVoices.length > 0) S.handleReadClick();
      }, 400);
      return;
    }

    var st = window.getState();

    if (st.isSpeaking && !st.isPaused) {
      // PAUSE
      S.isChunkTransitionCancelled = true;
      S.disarmWatchdog();
      try { S.synth.cancel(); } catch (e) {}
      window.setState({ isSpeaking: false, isPaused: true });
      S.setPlayButtonState('paused');
    } else if (st.isPaused) {
      // RESUME
      window.setState({ isPaused: false, isSpeaking: true });
      S.setPlayButtonState('playing');
      var text = S.getReadableText();
      var remaining = text.substring(st.lastIndex || 0);
      if (remaining.trim() !== '') S.speakText(remaining, true);
    } else {
      // FRESH START
      S.speakText();
    }
  };

  S.handleStop = function () {
    if (!S.synth) return;
    window.setState({ isLooping: false });
    S.setLoopVisual(false);
    S.isChunkTransitionCancelled = true;
    try { S.synth.cancel(); } catch (e) {}
    setTimeout(function () { try { S.synth.cancel(); } catch (e) {} }, 0);
    setTimeout(function () {
      try { S.synth.cancel(); } catch (e) {}
      S.isChunkTransitionCancelled = false;
    }, 200);
    S.disarmWatchdog();
    window.setState({ isPaused: false, isSpeaking: false, lastIndex: 0 });
    S.currentUtterance = null;
    S.setPlayButtonState('idle');
  };

  S.handleLoopClick = function () {
    var next = !window.getState().isLooping;
    window.setState({ isLooping: next });
    S.setLoopVisual(next);
  };

  S.seekBy = function (wordDelta) {
    var st = window.getState();
    var wasActive = st.isSpeaking && !st.isPaused;
    var txt = S.getReadableText();
    var idx = st.lastIndex || 0;
    if (wordDelta > 0) {
      for (var i = 0; i < wordDelta; i++) {
        while (idx < txt.length && !/\s/.test(txt[idx])) idx++;
        while (idx < txt.length && /\s/.test(txt[idx])) idx++;
      }
    } else {
      for (var j = 0; j < -wordDelta; j++) {
        while (idx > 0 && /\s/.test(txt[idx - 1])) idx--;
        while (idx > 0 && !/\s/.test(txt[idx - 1])) idx--;
      }
    }
    idx = Math.max(0, Math.min(idx, txt.length));
    window.setState({ lastIndex: idx });
    if (wasActive) {
      S.isChunkTransitionCancelled = true;
      S.disarmWatchdog();
      try { S.synth.cancel(); } catch (e) {}
      S.isChunkTransitionCancelled = false;
      var remaining = txt.substring(idx);
      if (remaining.trim() !== '') S.speakText(remaining, true);
      else S.finishReading();
    }
  };

  S.onSpeedChange = function () {
    var v = parseFloat(S.speedSlider.value);
    S.speedValue.textContent = v + 'x';
    window.setState({ speed: v });

    var st = window.getState();
    if (st.isSpeaking && !st.isPaused) {
      S.isChunkTransitionCancelled = true;
      S.disarmWatchdog();
      try { S.synth.cancel(); } catch (e) {}
      S.isChunkTransitionCancelled = false;
      var remaining = S.getReadableText().substring(st.lastIndex || 0);
      if (remaining.trim() !== '') S.speakText(remaining, true);
    }
  };

  S.initControls = function () {
    if (S.readBtn)    S.readBtn.addEventListener('click', S.handleReadClick);
    if (S.stopBtn)    S.stopBtn.addEventListener('click', S.handleStop);
    if (S.rewindBtn)  S.rewindBtn.addEventListener('click', function () { S.seekBy(-SEEK_WORD_COUNT); });
    if (S.forwardBtn) S.forwardBtn.addEventListener('click', function () { S.seekBy(SEEK_WORD_COUNT); });
    if (S.loopCheck)  S.loopCheck.addEventListener('click', S.handleLoopClick);

    if (S.speedSlider) {
      S.speedSlider.addEventListener('input', S.onSpeedChange);
      S.speedValue.textContent = S.speedSlider.value + 'x';
      window.setState({ speed: parseFloat(S.speedSlider.value) });
    }

    window.subscribe(function (state, prev) {
      if (state.speed !== prev.speed && S.speedSlider) {
        if (parseFloat(S.speedSlider.value) !== state.speed) {
          S.speedSlider.value = state.speed;
          S.speedValue.textContent = state.speed + 'x';
        }
      }
    });

    var st = window.getState();
    if (st.speed && S.speedSlider) {
      S.speedSlider.value = st.speed;
      S.speedValue.textContent = st.speed + 'x';
    }
  };

  // Used by workspace.js when switching to Analytics
  window.stopSpeech = function () { S.handleStop(); };

})();