/**
 * speech.js — classic script.
 * -----------------------------------------------------------------------------
 * Speech synthesis module.
 * Reads/writes text, voices, and speed via the hidden controls.
 * Wires popups triggered by #m-menu-btn.
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────────────────
  var CHUNK_CHAR_LIMIT = 250;
  var SEEK_WORD_COUNT = 5;

  // ─── DOM refs ────────────────────────────────────────────────────────────
  var synth, readBtn, stopBtn, rewindBtn, forwardBtn, loopCheck;
  var speedSlider, speedValue, voiceSearch, voiceSelect;
  var menuBtn, menuPopup, speedOpenBtn, speedPopup;
  var vOpen, vModal, vSearch, vSelect, vClose;

  // ─── Runtime ─────────────────────────────────────────────────────────────
  var allVoices = [];
  var filteredVoices = [];
  var currentUtterance = null;
  var speechChunks = [];
  var currentChunkIndex = 0;
  var chunkBaseIndex = 0;
  var isChunkTransitionCancelled = false;
  var chunkWatchdog = null;

  // ─── Init ────────────────────────────────────────────────────────────────
  function initSpeech() {
    synth              = window.speechSynthesis;
    readBtn            = document.getElementById('m-read-btn');
    stopBtn            = document.getElementById('m-stop-btn');
    rewindBtn          = document.getElementById('m-rewind-btn');
    forwardBtn         = document.getElementById('m-forward-btn');
    loopCheck          = document.getElementById('m-loop-check');
    
    // Hidden controls
    speedSlider        = document.getElementById('speed-slider');
    speedValue         = document.getElementById('speed-value');
    voiceSearch        = document.getElementById('voice-search');
    voiceSelect        = document.getElementById('voice-select');
    
    // Menu & Popups
    menuBtn            = document.getElementById('m-menu-btn');
    menuPopup          = document.getElementById('m-menu-popup');
    speedOpenBtn       = document.getElementById('m-speed-open-btn');
    speedPopup         = document.getElementById('m-speed-popup');
    
    // Voices Modal
    vOpen              = document.getElementById('m-voices-open-btn');
    vModal             = document.getElementById('voices-modal');
    vSearch            = document.getElementById('vm-search');
    vSelect            = document.getElementById('vm-select');
    vClose             = document.getElementById('vm-close');

    if (!synth) {
      console.warn('[speech] SpeechSynthesis not supported');
      return;
    }

    // ─── Voices ───
    populateVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = populateVoices;
    }

    // ─── Playback controls ───
    if (readBtn)      readBtn.addEventListener('click', handleReadClick);
    if (stopBtn)      stopBtn.addEventListener('click', handleStop);
    if (rewindBtn)    rewindBtn.addEventListener('click', function () { seekBy(-SEEK_WORD_COUNT); });
    if (forwardBtn)   forwardBtn.addEventListener('click', function () { seekBy(SEEK_WORD_COUNT); });
    if (loopCheck)    loopCheck.addEventListener('click', handleLoopClick);

    // ─── Speed ───
    if (speedSlider) {
      speedSlider.addEventListener('input', onSpeedChange);
      speedValue.textContent = speedSlider.value + 'x';
      window.setState({ speed: parseFloat(speedSlider.value) });
    }

    // ─── Voices UI ───
    if (voiceSearch) {
      var searchDebounce;
      voiceSearch.addEventListener('input', function () {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(populateVoices, 150);
      });
    }
    if (voiceSelect) voiceSelect.addEventListener('change', onVoiceSelectChange);

    // ─── Popups ───
    initPopups();

    // ─── React to state changes ───
    window.subscribe(function (state, prev) {
      if (state.speed !== prev.speed && speedSlider) {
        if (parseFloat(speedSlider.value) !== state.speed) {
          speedSlider.value = state.speed;
          speedValue.textContent = state.speed + 'x';
        }
      }
    });

    // Init from current state
    var st = window.getState();
    if (st.speed && speedSlider) {
      speedSlider.value = st.speed;
      speedValue.textContent = st.speed + 'x';
    }
  }

  // ─── Voices ──────────────────────────────────────────────────────────────
  function populateVoices() {
    allVoices = synth.getVoices();
    if (allVoices.length === 0) return;

    allVoices.sort(function (a, b) { return a.name.localeCompare(b.name); });

    var query = (voiceSearch && voiceSearch.value || '').toLowerCase().trim();

    filteredVoices = allVoices.filter(function (v) {
      return ((v.name + ' ' + v.lang).toLowerCase().indexOf(query) !== -1);
    });

    if (!voiceSelect) return;
    voiceSelect.innerHTML = '';
    
    var savedName = window.getState().selectedVoiceName;
    var targetIdx = 0;

    filteredVoices.forEach(function (voice, i) {
      var op = document.createElement('option');
      op.value = i;
      op.textContent = voice.name + ' (' + voice.lang + ')';
      if (savedName === voice.name) targetIdx = i;
      voiceSelect.appendChild(op);
    });

    if (filteredVoices.length > 0) {
      voiceSelect.selectedIndex = targetIdx;
      window.setState({ selectedVoiceName: filteredVoices[targetIdx].name });
    } else {
      var empty = document.createElement('option');
      empty.textContent = 'No matches found';
      voiceSelect.appendChild(empty);
    }

    window.setState({ voices: allVoices, filteredVoices: filteredVoices });
  }

  function onVoiceSelectChange() {
    var idx = parseInt(voiceSelect.value, 10);
    if (filteredVoices[idx]) {
      window.setState({ selectedVoiceName: filteredVoices[idx].name });
    }
  }

  // ─── Playback state visuals ──────────────────────────────────────────────
  function setPlayButtonState(state) {
    if (!readBtn) return;
    readBtn.classList.toggle('is-playing', state === 'playing');
    if (state === 'playing') readBtn.setAttribute('aria-label', 'Pause');
    else if (state === 'paused') readBtn.setAttribute('aria-label', 'Resume');
    else readBtn.setAttribute('aria-label', 'Read');
  }

  // ─── Loop ────────────────────────────────────────────────────────────────
  function setLoopVisual(enabled) {
    if (!loopCheck) return;
    loopCheck.classList.toggle('loop-on', enabled);
    loopCheck.classList.toggle('loop-off', !enabled);
    loopCheck.setAttribute('aria-label', enabled ? 'Loop on' : 'Loop off');
  }

  // ─── Read button ─────────────────────────────────────────────────────────
  function handleReadClick() {
    if (allVoices.length === 0) populateVoices();
    if (allVoices.length === 0) {
      setPlayButtonState('idle');
      setTimeout(function () {
        populateVoices();
        if (allVoices.length > 0) handleReadClick();
      }, 400);
      return;
    }

    var st = window.getState();

    if (st.isSpeaking && !st.isPaused) {
      // PAUSE
      isChunkTransitionCancelled = true;
      disarmWatchdog();
      try { synth.cancel(); } catch (e) {}
      window.setState({ isSpeaking: false, isPaused: true });
      setPlayButtonState('paused');
    } else if (st.isPaused) {
      // RESUME
      window.setState({ isPaused: false, isSpeaking: true });
      setPlayButtonState('playing');
      var text = getReadableText();
      var remaining = text.substring(st.lastIndex || 0);
      if (remaining.trim() !== '') speakText(remaining, true);
    } else {
      // FRESH START
      speakText();
    }
  }

  function getReadableText() {
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
  }

  // ─── Speak ───────────────────────────────────────────────────────────────
  function speakText(textOverride, isMidSentenceResume) {
    if (!isMidSentenceResume && !textOverride) {
      if (window.getState().isSpeaking) {
        isChunkTransitionCancelled = true;
        try { synth.cancel(); } catch (e) {}
        isChunkTransitionCancelled = false;
      }
      window.setState({ lastIndex: 0, isPaused: false });
    }
    var textToRead = textOverride || getReadableText();
    if (!textToRead.trim()) return;
    
    window.setState({ isSpeaking: true });
    setPlayButtonState('playing');
    
    var utteranceBaseIndex = isMidSentenceResume ? (window.getState().lastIndex || 0) : 0;
    speechChunks = splitIntoChunks(textToRead, CHUNK_CHAR_LIMIT);
    currentChunkIndex = 0;
    chunkBaseIndex = utteranceBaseIndex;
    playCurrentChunk();
  }

  function playCurrentChunk() {
    var chunkText = speechChunks[currentChunkIndex];
    var thisChunkBaseIndex = chunkBaseIndex;
    window.setState({ lastIndex: thisChunkBaseIndex });
    
    currentUtterance = new SpeechSynthesisUtterance(chunkText);
    
    var filtered = window.getState().filteredVoices || [];
    var selIdx = voiceSelect ? parseInt(voiceSelect.value, 10) : 0;
    if (filtered[selIdx]) currentUtterance.voice = filtered[selIdx];
    
    currentUtterance.rate = window.getState().speed || 0.75;
    
    currentUtterance.onboundary = function (e) {
      if (e.name === 'word') {
        window.setState({ lastIndex: thisChunkBaseIndex + e.charIndex });
      }
    };
    
    currentUtterance.onerror = function (e) {
      if (e.error === 'interrupted' || e.error === 'canceled') {
        isChunkTransitionCancelled = false;
        return;
      }
      console.warn('[speech] utterance error:', e.error);
      disarmWatchdog();
      currentChunkIndex++;
      chunkBaseIndex = thisChunkBaseIndex + chunkText.length;
      if (currentChunkIndex < speechChunks.length) playCurrentChunk();
      else finishReading();
    };
    
    currentUtterance.onend = function () {
      disarmWatchdog();
      if (isChunkTransitionCancelled) { isChunkTransitionCancelled = false; return; }
      currentChunkIndex++;
      chunkBaseIndex = thisChunkBaseIndex + chunkText.length;
      if (currentChunkIndex < speechChunks.length) {
        playCurrentChunk();
      } else {
        if (window.getState().isLooping) {
          window.setState({ lastIndex: 0 });
          speakText();
        } else {
          finishReading();
        }
      }
    };
    
    armWatchdog(chunkText);
    synth.speak(currentUtterance);
  }

  function finishReading() {
    disarmWatchdog();
    window.setState({ lastIndex: 0, isPaused: false, isSpeaking: false });
    setPlayButtonState('idle');
  }

  // ─── Chunking ────────────────────────────────────────────────────────────
  function splitIntoChunks(text, maxLen) {
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
  }

  // ─── Watchdog ────────────────────────────────────────────────────────────
  function armWatchdog(chunkText) {
    clearTimeout(chunkWatchdog);
    var rate = window.getState().speed || 1;
    var estMs = Math.max(5000, (chunkText.length / 14) * (1000 / rate) + 4000);
    chunkWatchdog = setTimeout(function () {
      if (isChunkTransitionCancelled) return;
      console.warn('[speech] watchdog fired — forcing next chunk');
      try { synth.cancel(); } catch (e) {}
      setTimeout(function () {
        if (isChunkTransitionCancelled) return;
        currentChunkIndex++;
        chunkBaseIndex += chunkText.length;
        if (currentChunkIndex < speechChunks.length) playCurrentChunk();
        else finishReading();
      }, 60);
    }, estMs);
  }

  function disarmWatchdog() {
    clearTimeout(chunkWatchdog);
    chunkWatchdog = null;
  }

  // ─── Stop ────────────────────────────────────────────────────────────────
  function handleStop() {
    window.setState({ isLooping: false });
    setLoopVisual(false);
    isChunkTransitionCancelled = true;
    try { synth.cancel(); } catch (e) {}
    setTimeout(function () { try { synth.cancel(); } catch (e) {} }, 0);
    setTimeout(function () {
      try { synth.cancel(); } catch (e) {}
      isChunkTransitionCancelled = false;
    }, 200);
    disarmWatchdog();
    window.setState({ isPaused: false, isSpeaking: false, lastIndex: 0 });
    currentUtterance = null;
    setPlayButtonState('idle');
  }

  // ─── Loop ────────────────────────────────────────────────────────────────
  function handleLoopClick() {
    var next = !window.getState().isLooping;
    window.setState({ isLooping: next });
    setLoopVisual(next);
  }

  // ─── Seek ────────────────────────────────────────────────────────────────
  function seekBy(wordDelta) {
    var st = window.getState();
    var wasActive = st.isSpeaking && !st.isPaused;
    var txt = getReadableText();
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
      isChunkTransitionCancelled = true;
      disarmWatchdog();
      try { synth.cancel(); } catch (e) {}
      isChunkTransitionCancelled = false;
      var remaining = txt.substring(idx);
      if (remaining.trim() !== '') speakText(remaining, true);
      else finishReading();
    }
  }

  // ─── Speed ───────────────────────────────────────────────────────────────
  function onSpeedChange() {
    var v = parseFloat(speedSlider.value);
    speedValue.textContent = v + 'x';
    window.setState({ speed: v });
    
    var st = window.getState();
    if (st.isSpeaking && !st.isPaused) {
      isChunkTransitionCancelled = true;
      disarmWatchdog();
      try { synth.cancel(); } catch (e) {}
      isChunkTransitionCancelled = false;
      var remaining = getReadableText().substring(st.lastIndex || 0);
      if (remaining.trim() !== '') speakText(remaining, true);
    }
  }

  // ─── Popups ──────────────────────────────────────────────────────────────
  function initPopups() {
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
  }

  window.initSpeech = initSpeech;
})();