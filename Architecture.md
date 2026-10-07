
---

## 📁 `ARCHITECTURE.md`

```markdown
# RecallRx — Architecture

A reference for anyone (human or AI) working on the codebase. Read this
after **README.md** and before touching any file.

---

## 1. Design Principles

1. **No build step.** Classic `<script>` tags. No bundler, no transpiler, no npm.
2. **One store.** A single source of truth in `state.js`. No scattered globals.
3. **Subscribe, don't poll.** Modules react to state changes rather than
   querying the DOM or calling each other directly.
4. **Private by default.** Every file is an IIFE. Only intentional APIs go
   on `window.*`.
5. **Works from `file://`.** No ES modules, no fetch, no service workers.
6. **Deploys as static files.** Drag to GitHub Pages and it runs.

---

## 2. The Store (`js/state.js`)

Every piece of app state lives here.

### API

```js
window.getState()              // → the full state object
window.setState({ ... })       // shallow-merge a patch; notifies subscribers
window.subscribe(fn)           // fn(state, prev) on every change
window.selectSubscribe(sel, fn)// only fires when the selector's value changes
window.resetState()            // back to initial