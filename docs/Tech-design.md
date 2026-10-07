# RecallRx — Technical Design

> A memory-training app for two-column lists (vocabulary, drug/class pairs, etc.)
> with text-to-speech, column-hiding practice, and a multi-mode exam.

---

## 1. Project Overview

### 1.1 Purpose
Let a user paste a two-column list, practice it by hiding a column, then test
themselves in a shuffled exam with three answer formats.

### 1.2 Target users
- Language learners (Vietnamese ⇄ English)
- Medical/clinical students (drug → mechanism, symptom → diagnosis)
- Anyone memorizing paired data

### 1.3 Core value
Fast, offline-capable, single-file-per-concern app. No accounts, no server.
Data lives in the browser. Deployable as a static site.

---

## 2. Architecture

### 2.1 Stack
- **HTML** — single `index.html`, no framework
- **CSS** — 4 files: `base`, `layout`, `components`, `responsive`
- **JS** — classic scripts (no ES modules, no bundler)
- **Storage** — `localStorage` under `recallrx:` namespace
- **Deployment** — GitHub Pages (static)

### 2.2 Design principles
1. **Single source of truth** — one store in `state.js`
2. **Subscribe, don't poll** — components react to state changes
3. **Classic scripts** — no build step, works from `file://` and GitHub Pages
4. **Progressive enhancement** — works without JS for reading, needs JS for editing

### 2.3 File tree
