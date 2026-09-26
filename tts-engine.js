// --- DOMAIN 3: VOICE DYNAMICS PROCESSING ENGINE ---

function guessGender(voiceName) {
    const name = voiceName.toLowerCase();
    return femaleKeywords.some(kw => name.includes(kw)) ? 'female' : 'male';
}

function clearSpeakingHighlight() {
    if (currentSpeakingSpan) {
        currentSpeakingSpan.classList.remove('speaking');
        window.currentSpeakingSpan = null;
    }
}

function stopHighlighting() {
    clearSpeakingHighlight();
    if (didAutoShowViewer) {
        recallViewer.classList.add('hidden');
        window.didAutoShowViewer = false;
    }
}

function populateVoices() {
    window.allVoices = synth.getVoices();
    if (allVoices.length === 0) return;
    
    allVoices.sort((a, b) => a.name.localeCompare(b.name));
    const savedGenderFilter = localStorage.getItem('savedGenderFilter') || 'all';
    genderFilter.value = savedGenderFilter;

    const searchQuery = voiceSearch.value.toLowerCase().trim();
    window.filteredVoices = allVoices.filter(v => {
        const matchesG = (savedGenderFilter === 'all') || (guessGender(v.name) === savedGenderFilter);
        return matchesG && `${v.name} ${v.lang}`.toLowerCase().includes(searchQuery);
    });

    voiceSelect.innerHTML = '';
    const savedVoiceName = localStorage.getItem('savedVoiceNameString');
    let targetIdx = 0;

    filteredVoices.forEach((voice, i) => {
        const op = document.createElement('option');
        op.value = i;
        op.textContent = `${voice.name} (${voice.lang}) [${guessGender(voice.name).toUpperCase()}]`;
        if (savedVoiceName === voice.name) targetIdx = i;
        voiceSelect.appendChild(op);
    });

    if (filteredVoices.length > 0) {
        voiceSelect.selectedIndex = targetIdx;
        localStorage.setItem('savedVoiceNameString', filteredVoices[targetIdx].name);
    } else {
        const op = document.createElement('option');
        op.textContent = "No matches found";
        voiceSelect.appendChild(op);
    }
}

if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = populateVoices;
populateVoices();

let voiceSearchDebounce;
voiceSearch.addEventListener('input', () => {
    clearTimeout(voiceSearchDebounce);
    voiceSearchDebounce = setTimeout(populateVoices, 150);
});

genderFilter.addEventListener('change', () => {
    localStorage.setItem('savedGenderFilter', genderFilter.value);
    localStorage.removeItem('savedVoiceNameString');
    populateVoices();
});

voiceSelect.addEventListener('change', () => {
    if (filteredVoices[voiceSelect.value]) localStorage.setItem('savedVoiceNameString', filteredVoices[voiceSelect.value].name);
});

function splitIntoChunks(text, maxLen) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        if (text.length - start <= maxLen) {
            chunks.push(text.slice(start));
            break;
        }
        let searchEnd = start + maxLen;
        let splitAt = -1;
        for (let i = searchEnd; i > start; i--) {
            if (/[.!?]/.test(text[i - 1])) { splitAt = i; break; }
        }
        if (splitAt === -1) {
            for (let i = searchEnd; i > start; i--) {
                if (/\s/.test(text[i])) { splitAt = i + 1; break; }
            }
        }
        if (splitAt === -1 || splitAt <= start) splitAt = searchEnd;
        chunks.push(text.slice(start, splitAt));
        start = splitAt;
    }
    return chunks;
}

readBtn.addEventListener('click', () => {
    if (allVoices.length === 0) populateVoices();

    if (synth.speaking && !isVoicePaused) {
        if (typeof stopTimer === 'function') stopTimer();
        window.isChunkTransitionCancelled = true;
        synth.cancel();
        window.isVoicePaused = true;
        readBtn.textContent = "Read";
        readBtn.classList.remove('is-active');
    } else if (isVoicePaused) {
        window.isVoicePaused = false;
        readBtn.textContent = "Pause ⏸";
        readBtn.classList.add('is-active');
        const remaining = textBox.value.replace(/\t/g, ' ').replace(/\n/g, ' ').substring(lastCharacterIndex);
        if (remaining.trim() !== "") speakText(remaining, true);
    } else {
        speakText();
    }
});

function speakText(textOverride = null, isMidSentenceResume = false) {
    if (!isMidSentenceResume && !textOverride) {
        if (synth.speaking) { window.isChunkTransitionCancelled = true; synth.cancel(); }
        window.lastCharacterIndex = 0;
        window.isVoicePaused = false;
        readBtn.textContent = "Read";
        readBtn.classList.remove('is-active');
    }
    
    const textToRead = textOverride || textBox.value.replace(/\t/g, ' ').replace(/\n/g, ' ');
    if (!textToRead.trim()) return;

    readBtn.textContent = "Pause ⏸";
    readBtn.classList.add('is-active');

    const utteranceBaseIndex = isMidSentenceResume ? lastCharacterIndex : 0;
    window.speechChunks = splitIntoChunks(textToRead, CHUNK_CHAR_LIMIT);
    window.currentChunkIndex = 0;
    window.chunkBaseIndex = utteranceBaseIndex;

    if (typeof startTimer === 'function') startTimer();
    playCurrentChunk();
}

function playCurrentChunk() {
    const chunkText = speechChunks[currentChunkIndex];
    const thisChunkBaseIndex = chunkBaseIndex;
    window.lastCharacterIndex = thisChunkBaseIndex;

    window.currentUtterance = new SpeechSynthesisUtterance(chunkText);
    if (filteredVoices[voiceSelect.value]) currentUtterance.voice = filteredVoices[voiceSelect.value];
    currentUtterance.rate = parseFloat(speedSlider.value);

    currentUtterance.onboundary = (e) => {
        if (e.name === 'word') {
            const absIdx = thisChunkBaseIndex + e.charIndex;
            window.lastCharacterIndex = absIdx;
        }
    };

    currentUtterance.onend = () => {
        if (isChunkTransitionCancelled) { window.isChunkTransitionCancelled = false; return; }
        window.currentChunkIndex++;
        window.chunkBaseIndex = thisChunkBaseIndex + chunkText.length;
        if (currentChunkIndex < speechChunks.length) {
            playCurrentChunk();
        } else {
            if (isLoopEnabled) { window.lastCharacterIndex = 0; speakText(); } 
            else { 
                if (typeof stopTimer === 'function') stopTimer(); 
                window.lastCharacterIndex = 0; 
                window.isVoicePaused = false; 
                readBtn.textContent = "Read"; 
                readBtn.classList.remove('is-active'); 
                stopHighlighting(); 
            }
        }
    };
    synth.speak(currentUtterance);
}

speedSlider.addEventListener('input', () => {
    speedValue.textContent = `${speedSlider.value}x`;
    if (synth.speaking && !isVoicePaused) {
        if (typeof stopTimer === 'function') stopTimer(); 
        window.isChunkTransitionCancelled = true; 
        synth.cancel();
        const rem = textBox.value.replace(/\t/g, ' ').replace(/\n/g, ' ').substring(lastCharacterIndex);
        if (rem.trim() !== "") speakText(rem, true);
    }
});

loopCheck.addEventListener('click', () => {
    window.isLoopEnabled = !isLoopEnabled;
    loopCheck.textContent = isLoopEnabled ? "Loop: ON" : "Loop: OFF";
    loopCheck.classList.toggle('loop-on', isLoopEnabled);
});

function seekBy(wordDelta) {
    const wasActive = synth.speaking && !isVoicePaused;
    const txt = textBox.value.replace(/\t/g, ' ').replace(/\n/g, ' ');
    let idx = lastCharacterIndex;

    if (wordDelta > 0) {
        for (let i = 0; i < wordDelta; i++) {
            while (idx < txt.length && !/\s/.test(txt[idx])) idx++;
            while (idx < txt.length && /\s/.test(txt[idx])) idx++;
        }
    } else {
        for (let i = 0; i < -wordDelta; i++) {
            while (idx > 0 && /\s/.test(txt[idx - 1])) idx--;
            while (idx > 0 && !/\s/.test(txt[idx - 1])) idx--;
        }
    }
    window.lastCharacterIndex = Math.max(0, Math.min(idx, txt.length));

    if (wasActive) {
        if (typeof stopTimer === 'function') stopTimer(); 
        window.isChunkTransitionCancelled = true; 
        synth.cancel();
        const remaining = txt.substring(lastCharacterIndex);
        if (remaining.trim() !== "") speakText(remaining, true);
        else { window.isVoicePaused = false; readBtn.textContent = "Read"; readBtn.classList.remove('is-active'); stopHighlighting(); }
    }
}

rewindBtn.addEventListener('click', () => seekBy(-SEEK_WORD_COUNT));
forwardBtn.addEventListener('click', () => seekBy(SEEK_WORD_COUNT));

stopBtn.addEventListener('click', () => {
    window.isLoopEnabled = false; 
    loopCheck.textContent = "Loop: OFF"; 
    loopCheck.classList.remove('loop-on');
    window.isChunkTransitionCancelled = true; 
    synth.cancel(); 
    if (typeof stopTimer === 'function') stopTimer();
    window.isVoicePaused = false; 
    readBtn.textContent = "Read"; 
    readBtn.classList.remove('is-active');
    window.lastCharacterIndex = 0; 
    stopHighlighting();
});
