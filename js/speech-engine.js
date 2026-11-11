/**
 * speech-engine.js — classic script.
 * Text source, chunking, utterance playback and watchdog.
 * Shared namespace: window.__speech__ (S)
 */
(function () {
  'use strict';
  var S = window.__speech__ = window.__speech__ || {};

  var CHUNK_CHAR_LIMIT = 250;

  var speechChunks = [];
  var currentChunkIndex = 0;
  var chunkBaseIndex = 0;
  var chunkWatchdog = null;
  var speechHeartbeat = null;
  
  // Freezes text to what was viewed at playback start
  var activeTextSnapshot = '';

  // Shared with speech-controls.js
  S.currentUtterance = null;
  S.isChunkTransitionCancelled = false;

  S.getReadableText = function () {
    var st = window.getState();
    if (st.viewMode === 'notes') {
      var noteArea = document.getElementById('note-area');
      return noteArea ? noteArea.value.replace(/\t/g, ' ').replace(/\n/g, ' ') : '';
    }
    if (st.viewMode === 'privacy') {
      var privacyEl = document.getElementById('privacy-workspace');
      return privacyEl ? privacyEl.innerText.replace(/\s+/g, ' ').trim() : '';
    }
    var rows = st.rows || [];
    var parts = [];
    rows.forEach(function (r) {
      if (r.a) parts.push(r.a);
      if (r.b) parts.push(r.b);
    });
    return parts.join(' ').replace(/\t/g, ' ').replace(/\n/g, ' ');
  };

  S.speakText = function (textOverride, isMidSentenceResume) {
    if (!isMidSentenceResume && !textOverride) {
      if (window.getState().isSpeaking) {
        S.isChunkTransitionCancelled = true;
        try { S.synth.cancel(); } catch (e) {}
        S.isChunkTransitionCancelled = false;
      }
      window.setState({ lastIndex: 0, isPaused: false });
      
      // FRESH START: Capture current text view into immutable snapshot
      activeTextSnapshot = S.getReadableText();
    }
    
    // Use override (like middle resume text) or fall back to frozen snapshot
    var textToRead = textOverride || activeTextSnapshot;
    if (!textToRead.trim()) return;

    window.setState({ isSpeaking: true });
    S.setPlayButtonState('playing');

    var utteranceBaseIndex = isMidSentenceResume ? (window.getState().lastIndex || 0) : 0;
    speechChunks = S.splitIntoChunks(textToRead, CHUNK_CHAR_LIMIT);
    currentChunkIndex = 0;
    chunkBaseIndex = utteranceBaseIndex;
    
    startHeartbeat();
    playCurrentChunk();
  };

  function playCurrentChunk() {
    var chunkText = speechChunks[currentChunkIndex];
    var thisChunkBaseIndex = chunkBaseIndex;
    window.setState({ lastIndex: thisChunkBaseIndex });

    S.currentUtterance = new SpeechSynthesisUtterance(chunkText);

    var filtered = window.getState().filteredVoices || [];
    var selIdx = S.voiceSelect ? parseInt(S.voiceSelect.value, 10) : 0;
    if (filtered[selIdx]) S.currentUtterance.voice = filtered[selIdx];

    S.currentUtterance.rate = window.getState().speed || 0.75;

    S.currentUtterance.onboundary = function (e) {
      if (e.name === 'word') {
        window.setState({ lastIndex: thisChunkBaseIndex + e.charIndex });
      }
    };

    S.currentUtterance.onerror = function (e) {
      if (e.error === 'interrupted' || e.error === 'canceled') {
        S.isChunkTransitionCancelled = false;
        return;
      }
      console.warn('[speech] utterance error:', e.error);
      S.disarmWatchdog();
      currentChunkIndex++;
      chunkBaseIndex = thisChunkBaseIndex + chunkText.length;
      if (currentChunkIndex < speechChunks.length) playCurrentChunk();
      else S.finishReading();
    };

    S.currentUtterance.onend = function () {
      S.disarmWatchdog();
      if (S.isChunkTransitionCancelled) { S.isChunkTransitionCancelled = false; return; }
      currentChunkIndex++;
      chunkBaseIndex = thisChunkBaseIndex + chunkText.length;
      if (currentChunkIndex < speechChunks.length) {
        playCurrentChunk();
      } else {
        if (window.getState().isLooping) {
          window.setState({ lastIndex: 0 });
          S.speakText();
        } else {
          S.finishReading();
        }
      }
    };

    armWatchdog(chunkText);
    S.synth.speak(S.currentUtterance);
  }

  S.finishReading = function () {
    S.disarmWatchdog();
    stopHeartbeat();
    window.setState({ lastIndex: 0, isPaused: false, isSpeaking: false });
    S.setPlayButtonState('idle');
    activeTextSnapshot = ''; // Clear out frozen text allocation
  };

  S.splitIntoChunks = function (text, maxLen) {
    var chunks = [];
    var start = 0;
    while (start < text.length) {
      if (text.length - start <= maxLen) {
        chunks.push(text.slice(start));
        break;
      }
      var searchEnd = start + maxLen;
      var splitAt = -1;
      for (var i = searchEnd; i > start; i--) {
        if (/[.!?]/.test(text[i - 1])) { splitAt = i; break; }
      }
      if (splitAt === -1) {
        for (var j = searchEnd; j > start; j--) {
          if (/\s/.test(text[j])) { splitAt = j + 1; break; }
        }
      }
      if (splitAt === -1 || splitAt <= start) splitAt = searchEnd;
      chunks.push(text.slice(start, splitAt));
      start = splitAt;
    }
    return chunks;
  };

  function armWatchdog(chunkText) {
    clearTimeout(chunkWatchdog);
    var rate = window.getState().speed || 1;
    var estMs = Math.max(5000, (chunkText.length / 14) * (1000 / rate) + 4000);
    chunkWatchdog = setTimeout(function () {
      if (S.isChunkTransitionCancelled) return;
      console.warn('[speech] watchdog fired — forcing next chunk');
      try { S.synth.cancel(); } catch (e) {}
      setTimeout(function () {
        if (S.isChunkTransitionCancelled) return;
        currentChunkIndex++;
        chunkBaseIndex += chunkText.length;
        if (currentChunkIndex < speechChunks.length) playCurrentChunk();
        else S.finishReading();
      }, 60);
    }, estMs);
  }

  S.disarmWatchdog = function () {
    clearTimeout(chunkWatchdog);
    chunkWatchdog = null;
  };

  function startHeartbeat() {
    stopHeartbeat();
    speechHeartbeat = setInterval(function () {
      var st = window.getState();
      // Only poke if actively reading and NOT explicitly paused by user
      if (st.isSpeaking && !st.isPaused && S.synth && S.synth.speaking && !S.synth.paused) {
        try {
          S.synth.pause();
          S.synth.resume();
        } catch (e) {}
      }
    }, 10000);
  }

  function stopHeartbeat() {
    if (speechHeartbeat) {
      clearInterval(speechHeartbeat);
      speechHeartbeat = null;
    }
  }

})();
