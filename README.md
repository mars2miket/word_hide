# Vault Recall

[Live Web Application Link via GitHub Pages: https://mars2miket.github.io/vault_recall/]

## 1. Product Goal
Vault Recall is a web app built to turn lists into quick memory tests. Flashcard apps usually force you to create an account, while spreadsheets are clumsy for self-testing. Vault Recall solves this by instantly converting any pasted two-column list into an interactive, testable deck directly in your browser.

### Who it is for
* **The Quick Learner:** Wants to paste a list of terms, hide a column, and test themselves immediately without signing up.
* **The Mobile User:** Wants an app that runs locally so they can study their material while moving, without needing a steady internet connection.
* **The Cross-Device Learner:** Wants optional cloud sync across desktop and mobile without giving up instant offline speed. 
    Note: Invite-Only Cloud Access: Disabled public self-registration and anonymous sign-ins in Supabase so cloud sync is strictly restricted to manually provisioned accounts, preventing unauthorized database usage and quota abuse.

---

## 2. Product Setup & Scope
I defined the requirements, set the boundaries, and managed the work to build this modular JavaScript application.

* **Modular Organization:** Split the code into clean, dedicated files (`grid.js`, `exam.js`, `storage.js`, `cloud-sync.js`) with zero build tools to keep the app lightweight and easy to maintain.
* **Phased Storage Evolution (Local MVP to Hybrid Cloud):** Launched initially as a zero-server local app to hit a fast release date, then evolved it into a hybrid local-first and Supabase/PostgreSQL model—keeping guests in `localStorage` with zero sign-up friction while giving invited accounts automatic cross-device sync.
* **Application Security Hardening:** Enforced PostgreSQL Row-Level Security (`RLS`), invite-only authentication with tightened brute-force rate limits, and XSS-safe DOM rendering across all dynamic UI modules.
* **Multi-Language Support & Question Bank:** Set up a translation system for English, Vietnamese, and French, alongside a built-in Question Bank (`banks/*.csv`) and a Testing Analysis dashboard (`analytics.js`) to track missed terms over time.

---

## 3. User Acceptance Testing (UAT)
I acted as the lead tester, running manual test scripts across desktop and mobile browsers to find bugs and ensure the interface works on all screen sizes.

### Core Testing Issues Found
* **Mobile Audio Interruption:** Found that mobile phones pause the text-to-speech engine when the browser tab is hidden or the screen locks. Wrote down the technical requirements and created test cases to find a workaround for background playback.
* **Mobile Screen Layout:** Found navigation issues on smaller phone screens. Designed a layout rule that moves crowded settings buttons into clean mobile popup menus and dismisses the mobile drawer cleanly when switching views.
* **Data Entry Validation:** Created a rule that highlights duplicate words in yellow instantly so users don't mess up their quiz scores.
* **Hybrid Sync & Reload Isolation:** Caught stale local data flashing briefly on page reload before cloud hydration completed, and added synchronous startup guards plus tab-close flush handling so edits never get dropped.

---

## 4. Next Steps
* **Alternative Audio Handling:** Look into improving audio stream due to buggy local browser limitations.
