# RecallRx

A browser-based memory-training tool for two-column lists — vocabulary,
medical pairs, or anything else you need to memorize.

Paste your data, practice by hiding a column, then take a graded test
in multiple-choice, true/false, or fill-in-blank mode. Playback reads
your list aloud at any speed.

**No accounts. No server. No install. Just open it and go.**

---

## Live Demo

> Deploy URL goes here once published to GitHub Pages.

---

## Features

### Data entry
- Editable two-column grid
- Paste from Excel / Google Sheets / plain text (multi-row, multi-column supported)
- Auto-appends a blank trailing row
- Delete individual rows (hover over a row's B cell → 🗑)
- Sort either column A→Z or Z→A

### Practice
- **Hide Col A / Hide Col B** — masks a column so you can self-test
- Click a masked cell to reveal it for editing; click away to re-mask
- Everything auto-saves to your browser's localStorage

### Exam
- **Start Test** builds a shuffled deck from rows where both cells have content
- Three modes:
  - **Multi Choice** — pick the correct answer from four options
  - **T / F** — is this pairing correct?
  - **Fill-in-Blank** — type the answer
- **A → B** / **B → A** direction toggle
- Score counter, Next button, complete screen with missed items
- Results are saved to a **Results** note (see Notes)

### Lists & Notes
- **Lists** — multiple decks, each with its own grid data
  - Create / Rename / Delete
  - Export to `.txt`
  - Import from `.txt` as a new list
- **Notes** — free-text notes with adjustable height
  - Create / Rename / Delete
  - **Results** note is auto-populated by the exam

### Playback
- Text-to-speech of the current list or note
- Play / Pause / Stop / Rewind / Forward / Loop
- Speed slider: 0.25× to 2.0×
- Voice picker with gender filter and search
- Mobile playback bar at the bottom of the screen

### Other
- **Dark / Light theme** — toggle in the top bar
- **English / Vietnamese** — toggle in the top bar
- Everything persists across refresh (theme, language, active list, active note, view mode)
- Fully responsive: works on desktop and mobile

---

## How to Use

1. **Open the app** in any modern browser.
2. **Type or paste** your data into the grid — column A is the prompt, column B is the answer.
3. **Practice** by clicking **Hide Col A** or **Hide Col B**.
4. **Test yourself** by clicking **Start Test**.
5. **Review results** in the **Results** note (toggle to Notes view).

---

## Running Locally

No build step. No dependencies. No npm.

**Option 1 — Double-click `index.html`.**
Works immediately for personal use.

**Option 2 — Serve locally (recommended for development).**

```bash
# From the project folder
python -m http.server 8000