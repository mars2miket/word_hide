RecallRx i18n system
├── Locale files (static string dictionaries)
│   ├── js/locales/en.js       ← English strings
│   └── js/locales/vi.js       ← Vietnamese strings
│
├── Engine (js/i18n.js)
│   ├── Reads all dictionaries from window.__LOCALES__
│   ├── Reads current language from localStorage ('recallrx-lang')
│   ├── Walks the DOM for [data-i18n] attributes and swaps text
│   ├── Walks for [data-i18n-title], [data-i18n-aria], [data-i18n-placeholder]
│   ├── Cycles through available languages on #lang-toggle click
│   ├── Exposes window.__i18n__.t(key) for JS-generated strings
│   └── Re-renders exam shell after each language change
│
├── HTML markup (index.html)
│   ├── <script src="js/locales/en.js"> BEFORE i18n.js
│   ├── <script src="js/locales/vi.js"> BEFORE i18n.js
│   ├── <script src="js/i18n.js">       BEFORE app.js
│   ├── <html> bootstrap script in <head> restores saved lang pre-paint
│   └── Elements tagged with:
│       ├── data-i18n="key"            → textContent
│       ├── data-i18n-title="key"      → title attribute
│       ├── data-i18n-aria="key"       → aria-label attribute
│       └── data-i18n-placeholder="key"→ placeholder attribute
│
└── CSS-driven strings (app.css)
    └── NONE — all visible strings moved to HTML/JS so i18n can reach them


Adding a Language

js/locales/en.js       ← dictionary (English)
js/locales/vi.js       ← dictionary (Vietnamese)
js/i18n.js             ← engine
index.html             ← script tags + data-i18n attributes
How the system works
Each locale file registers itself on window.__LOCALES__.<code> as a plain object of key: "translated string".

i18n.js reads all keys from window.__LOCALES__, walks the DOM for data-i18n / data-i18n-title / data-i18n-aria / data-i18n-placeholder attributes, and swaps them.

The #lang-toggle button cycles through every detected language.

Saved to localStorage['recallrx-lang']. Restored in a <head> script before paint.

JS-generated strings (e.g. exam mode labels) use window.__i18n__.t('key').

To add a language
Create js/locales/<code>.js. Copy the structure of en.js, change the top-level key to the new language code, translate every value. Every key in en.js must exist here. Missing keys fall back to English.

In index.html, add <script src="js/locales/<code>.js"></script> before the i18n.js script tag.

Optionally add the short display code to the SHORT map in i18n.js (e.g. es: 'ES').

That's it — the engine picks up the new language automatically.

Rules to follow
Never put user-visible text in CSS (content: "..."). Put it in HTML with data-i18n, or in JS via window.__i18n__.t().

Never hardcode strings in JS without routing through window.__i18n__.t().

Don't put data-i18n on an element that has child elements — the engine replaces textContent and would delete the children. Wrap the label in its own <span>.

Never rename keys. Change the value, not the key.

Known untranslated areas (future work)
Confirm modal text (Are you sure? / Cancel / Confirm) — needs data-i18n attributes added.

Native alert() / prompt() dialogs — can't be translated without custom UI.

Voice names from the Web Speech API — come from the OS.