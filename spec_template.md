RECALLRX — BUILD SPEC

DELIVERABLES
List every file with a one-line purpose:
  index.html
  styles/base.css       (theme vars, reset, app shell, top bar)
  styles/app.css        (sidebar, grid, exam, notes, mobile)
  js/config.js          (global state, DOM refs, constants)
  js/app.js             (sidebar toggle, accordion, theme, viewport lock)
  js/modal.js           (showConfirm)
  js/spreadsheet.js     (grid, paste parsing, masking, list management CRUD, row delete)
  js/lists-notes.js     (list import/export, notes mode)
  js/sorting.js         (column sort)
  js/exam.js            (exam shell, 3 modes, i18n hooks)
  js/speech.js          (Web Speech API, chunking, seek, loop, timer)
  js/i18n.js            (engine)
  js/locales/en.js
  js/locales/vi.js

CONSTRAINTS
  - Vanilla JS, no build step, no frameworks
  - Works from file:// (no fetch for locale loading)
  - Mobile-first breakpoint at 700px
  - localStorage keys: recallrx-theme, recallrx-lang, whLists, whNotes,
    whActiveList, whActiveNote, whMode, savedSpreadsheetGridData,
    savedVoiceNameString, savedGenderFilter

DOM CONTRACT (critical)
Give the exact IDs and structure the code expects:
  #sidebar-wrapper (flex row container, has .open / .collapsed)
  #sidebar-toggle, #lang-toggle, #theme-toggle in .brand
  #list-select, #note-select, #gender-filter, #voice-search, #voice-select
  #speed-slider, #speed-value
  #read-btn, #stop-btn, #rewind-btn, #forward-btn, #loop-check
  #m-rewind-btn, #m-stop-btn, #m-read-btn, #m-forward-btn, #m-loop-check, #m-menu-btn
  #m-menu-popup, #m-speed-popup (with .speed-opt [data-speed])
  #spreadsheet-container with .header-cell[data-col="A"|"B"] and .resizer
  #recall-viewer, #note-area, #note-resizer, .row-resizer
  #timer-display, #timer-reset-btn
  #char-count, #time-estimate
  #confirm-modal with #confirm-modal-title/message/ok/cancel

CSS BEHAVIOR RULES (get these wrong and you'll iterate for hours)
  - Sidebar transitions: 1s on BOTH open and close, declared ONLY on the
    base rule, never re-declared on .collapsed
  - On mobile, sidebar is position:absolute with height transition, no
    `bottom: auto` toggling (breaks interpolation)
  - Never put user-visible text in CSS content: — it can't be translated
  - Exam shell uses flex: 1 1 auto + min-height: 0 to fill remaining
    vertical space; grid above it is flex-shrink: 0 with max-height cap
  - .input-workspace padding-bottom on mobile =
    calc(56px + env(safe-area-inset-bottom, 0))

JS BEHAVIOR RULES
  - Speech: never trust synth.speaking on Android. Track your own
    isSpeaking flag. Cancel multiple times across setTimeouts to
    defeat Android's late-queue
  - Chunking: split text at 250-char boundaries, prefer sentence
    boundaries, fall back to word boundaries
  - Watchdog: fire a forced next-chunk after an estimated duration
  - Loop: when enabled, restart from index 0 on finish
  - Paste: detect \t / \n in clipboard, distribute across cells;
    also parse text/html <table> if plain text has no delimiters
  - Masking: split cell text on /(\s+)/, wrap non-whitespace in
    <span class="recall-word col-hidden">
  - Exam: single-open examDeck shuffle, avoid same item twice in a row
  - Confirm modal: replace every confirm() with showConfirm()

i18n REQUIREMENTS (the biggest source of iteration)
  - Three translation paths: data-i18n attributes (static DOM),
    window.__i18n__.t(key) (JS strings), never CSS content:
  - On language change, engine must:
      1. Walk DOM for all data-i18n* attributes
      2. Save to localStorage
      3. Call window.refreshExamLanguage() if it exists
  - Exam module must rebuild its shell on language change:
      - refreshExamLanguage() → if currentItem && isQuestionActive,
        call drawActiveQuestion(currentItem); else renderShell()
      - refreshShellChrome(wrapper) re-applies t() to persistent
        elements (Exam Prompt, Check Answer, Next) that buildShell()
        creates but drawActiveQuestion() doesn't rebuild
      - Mode bar rebuilt inside drawActiveQuestion (via buildModeBar())
  - Locale files load BEFORE i18n.js; i18n.js loads BEFORE app.js
  - <head> inline script restores theme + lang from localStorage
    before paint, defaults theme to 'dark'

BEHAVIOR OF LAYOUT ELEMENTS
  - Desktop: sidebar is 280px inline-flex column, collapses to 0 width
  - Mobile: sidebar is an overlay that slides down from the top,
    full viewport width, collapses to 0 height
  - Desktop playback buttons live inside Controls accordion
  - Mobile playback buttons live in a fixed bottom bar; the desktop
    Controls accordion is hidden on mobile
  - Mobile menu (hamburger) opens a popup with "Speed"; tapping Speed
    opens a second popup with the speed list; picking a value
    applies it, closes both popups, and auto-resumes if mid-playback

THEME
  - data-theme on <html>, 'dark' or 'light'
  - All colors via CSS variables in :root and [data-theme="dark"]
  - Default is dark on first visit
  - Persist to localStorage['recallrx-theme']

LANGUAGE
  - data-lang on <html>, code from window.__LOCALES__ keys
  - Toggle cycles through all registered locales in order
  - Persist to localStorage['recallrx-lang']

WHAT TO GET RIGHT THE FIRST TIME
  (each of these cost us at least one round-trip)
  1. Sidebar transition declared only on the base rule
  2. Android stop = multi-cancel + own isSpeaking flag
  3. Exam shell refresh includes Exam Prompt / Check Answer / Next
     buttons — not just the mode bar and body
  4. Mobile exam shell must flex-grow into remaining vertical space;
     no max-height cap; grid above it caps itself
  5. Never use CSS content: for visible strings
  6. Never put data-i18n on an element with child markup
  7. Chunked speech needs a watchdog or Chrome will stall silently