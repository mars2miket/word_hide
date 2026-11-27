# Vault Recall — High-Level Dependency Tree

## 1. Visual Dependency Flow (Upstream → Downstream)

```text
Vault Recall (Static PWA — No Build Step)
│
├── [Entry & Offline Shell]
│   ├── index.html ──────────────────────────► Loads all CSS, CDN SDK, & JS in strict order
│   ├── manifest.json ◄────────────────────── Linked by index.html (PWA metadata)
│   └── sw.js ───────────────────────────────► Caches all local assets; bypasses *.supabase.co
│
├── [Styles Layer] (Loaded by index.html)
│   ├── styles/tokens.css ───────────────────► Upstream root variables (Dark / Light / Cyber)
│   ├── styles/reset.css ────────────────────► Base normalization
│   ├── styles/layout.css ───────────────────► App shell & view-mode containers
│   ├── styles/components.css ───────────────► Modals, grid, exam, analytics, & sync banners
│   ├── styles/responsive.css ───────────────► 700px breakpoint overrides
│   └── styles/qbank.css ────────────────────► Question Bank modal styling
│
└── [JavaScript Layer] (Strict Load Order)
    │
    ├── 1. External SDK & Cloud Config
    │   ├── @supabase/supabase-js@2 (CDN) ───► Upstream Supabase SDK
    │   └── js/supabase-client.js ───────────► Exposes frozen window.supabaseClient
    │
    ├── 2. Core Foundation (Upstream to all feature modules)
    │   ├── js/storage.js ───────────────────► Exposes window.storage (vault-recall:*)
    │   └── js/state.js ─────────────────────► Exposes getState / setState / subscribe
    │
    ├── 3. Hybrid Cloud Sync Adapter
    │   └── js/cloud-sync.js ────────────────► Requires: supabaseClient, storage, state, lists, grid
    │                                          Exposes: window.cloudSync, initCloudSync()
    │
    ├── 4. Localization (i18n)
    │   ├── js/locales/en.js ────────────────► Attaches window.__LOCALES__.en
    │   ├── js/locales/vi.js ────────────────► Attaches window.__LOCALES__.vi
    │   ├── js/locales/fr.js ────────────────► Attaches window.__LOCALES__.fr
    │   └── js/i18n.js ──────────────────────► Requires: __LOCALES__, state
    │                                          Exposes: window.__i18n__ (t, apply)
    │
    ├── 5. UI & Navigation
    │   ├── js/nav.js ───────────────────────► Requires: state, storage, i18n, cloudSync
    │   ├── js/modal.js ─────────────────────► Requires: i18n (Exposes showConfirm/Prompt/Alert)
    │   └── js/onboarding.js ────────────────► Requires: storage, state
    │
    ├── 6. Spreadsheet Grid & Helpers
    │   ├── js/grid.js ──────────────────────► Requires: state, storage
    │   │                                      Exposes: __gridRerender__, updateCharCount, syncStartTestButton
    │   ├── js/sorting.js ───────────────────► Requires: state, grid
    │   └── js/duplicates.js ────────────────► Requires: state
    │
    ├── 7. Content Managers (Decks, Notes, Question Bank)
    │   ├── js/lists.js ─────────────────────► Requires: state, modal, grid, i18n
    │   │                                      Exposes: listActions, serializeGrid, parseList, getDisplayName
    │   ├── js/notes.js ─────────────────────► Requires: state, storage, modal, i18n
    │   │                                      Exposes: noteActions
    │   └── js/qbank.js ─────────────────────► Requires: state, storage, modal, lists, grid, i18n, banks/*.csv
    │                                          Exposes: qbankWrongFor()
    │
    ├── 8. Text-to-Speech (TTS) Engine
    │   └── js/speech/
    │       ├── speech-core.js ──────────────► Requires: state, i18n (DOM refs & initSpeech)
    │       ├── speech-engine.js ────────────► Requires: speech-core, state
    │       ├── speech-controls.js ──────────► Requires: speech-core, state
    │       ├── speech-voices.js ────────────► Requires: speech-core, state
    │       └── speech-popups.js ────────────► Requires: speech-core, state
    │
    ├── 9. Testing, Analytics & View Switcher
    │   ├── js/exam.js ──────────────────────► Requires: state, storage, lists, grid, qbank, cloudSync, i18n
    │   ├── js/analytics.js ─────────────────► Requires: state, cloudSync, i18n
    │   └── js/workspace.js ─────────────────► Requires: state, lists, notes, grid, speech-engine, i18n
    │
    └── 10. Application Bootstrap (Terminal Downstream Entry)
        └── js/main.js ──────────────────────► Requires: ALL modules above (hydrates state & runs init* order)
```

---

## 2. Upstream vs. Downstream Matrix

| File | Upstream Dependencies (Reads From) | Downstream Dependents (Used By) |
| :--- | :--- | :--- |
| **`index.html`** | `styles/*.css`, `manifest.json`, CDN SDK, `js/**/*.js` | Browser DOM, `sw.js` |
| **`sw.js`** | All local HTML, CSS, JS, icons, and `banks/*.csv` | Browser Service Worker cache |
| **`styles/tokens.css`** | None (Root CSS custom properties) | `reset.css`, `layout.css`, `components.css`, `responsive.css`, `qbank.css` |
| **`js/supabase-client.js`** | `@supabase/supabase-js@2` (CDN) | `js/cloud-sync.js` |
| **`js/storage.js`** | Browser `localStorage` | `main.js`, `nav.js`, `onboarding.js`, `grid.js`, `qbank.js`, `notes.js`, `exam.js`, `cloud-sync.js` |
| **`js/state.js`** | None (Central pub/sub store) | Almost all `/js/*.js` modules |
| **`js/cloud-sync.js`** | `supabase-client.js`, `storage.js`, `state.js`, `lists.js`, `grid.js`, `modal.js` | `main.js`, `nav.js`, `exam.js`, `analytics.js` |
| **`js/locales/*.js`** | None (Static translation dictionaries) | `js/i18n.js` |
| **`js/i18n.js`** | `js/locales/{en,vi,fr}.js`, `state.js` | `nav.js`, `modal.js`, `lists.js`, `notes.js`, `qbank.js`, `exam.js`, `analytics.js`, `workspace.js`, `speech-core.js` |
| **`js/modal.js`** | `i18n.js` | `lists.js`, `notes.js`, `qbank.js`, `cloud-sync.js` |
| **`js/nav.js`** | `state.js`, `storage.js`, `i18n.js`, `cloud-sync.js`, `onboarding.js`, `workspace.js` | `main.js` |
| **`js/grid.js`** | `state.js`, `storage.js`, `i18n.js` | `sorting.js`, `lists.js`, `qbank.js`, `exam.js`, `workspace.js`, `cloud-sync.js`, `main.js` |
| **`js/sorting.js`** | `state.js`, `grid.js` | `main.js` |
| **`js/duplicates.js`** | `state.js` | `main.js` |
| **`js/lists.js`** | `state.js`, `modal.js`, `grid.js`, `i18n.js` | `exam.js`, `qbank.js`, `workspace.js`, `cloud-sync.js`, `main.js` |
| **`js/notes.js`** | `state.js`, `storage.js`, `modal.js`, `grid.js`, `i18n.js` | `workspace.js`, `main.js` |
| **`js/qbank.js`** | `state.js`, `storage.js`, `modal.js`, `lists.js`, `grid.js`, `i18n.js`, `banks/*.csv` | `exam.js`, `main.js` |
| **`js/speech/*.js`** | `state.js`, `i18n.js` | `workspace.js`, `main.js` |
| **`js/exam.js`** | `state.js`, `storage.js`, `lists.js`, `grid.js`, `qbank.js`, `cloud-sync.js`, `i18n.js` | `main.js` |
| **`js/analytics.js`** | `state.js`, `cloud-sync.js`, `i18n.js` | `main.js` |
| **`js/workspace.js`** | `state.js`, `lists.js`, `notes.js`, `grid.js`, `speech-engine.js`, `i18n.js` | `nav.js`, `exam.js`, `notes.js`, `main.js` |
| **`js/main.js`** | All `init*()` functions, `storage.js`, `state.js`, `cloud-sync.js` | None (Terminal entry point) |
