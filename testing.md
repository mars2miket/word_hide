
---

## 📁 `TESTING.md`

```markdown
# RecallRx — Manual Test Checklist

Run through this list after any change. It covers the paths most likely
to break. Should take about 5–10 minutes.

**Before starting:**
- Open DevTools (F12)
- Keep the Console tab visible — any red error is a blocker
- Hard-refresh the page (`Ctrl + Shift + R`) before starting

---

## 1. First Load

- [ ] Page loads with no red errors in Console
- [ ] Dark theme applied (or your last chosen theme)
- [ ] Top bar shows "RecallRx", EN button, theme toggle
- [ ] Onboarding hint card is visible (if not dismissed)
- [ ] Sidebar shows: Lists, Notes, Voices, Controls, Timer
- [ ] Workspace shows: toggle, dropdown, grid, Start Test

---

## 2. Grid

- [ ] Grid has one blank row on first load
- [ ] Type "hello" in A1 → new blank row appears
- [ ] Type "world" in B1 → no new row appended (already there)
- [ ] Paste a 5×2 block from Excel → all 5 rows fill
- [ ] Paste a 3×2 block starting in B1 → columns shift correctly
- [ ] Hover over row 1's B cell → 🗑 appears
- [ ] Click 🗑 → row disappears
- [ ] Delete the last row → one blank row remains
- [ ] Refresh → all rows persist, one blank trailing row

---

## 3. Hide Columns

- [ ] Click "Hide Col A" → header changes to "Show Col A"
- [ ] Column A cells become dark blocks (text hidden)
- [ ] Click a masked cell → text reveals for editing
- [ ] Click away → text re-masks
- [ ] Click "Show Col A" → all cells reveal
- [ ] Same test for Col B

---

## 4. Lists

- [ ] Dropdown shows "Select a List" + your lists
- [ ] ➕ button → prompts for name → creates list → switches to it
- [ ] ✏️ button → prompts to rename → list renamed
- [ ] 🗑 button → confirm → list deleted
- [ ] Switching lists saves current grid into the outgoing list
- [ ] Export button → downloads `.txt`
- [ ] Import button → opens file picker → imports as new list
- [ ] Refresh → active list persists

---

## 5. Notes

- [ ] Toggle to Notes → textarea appears, grid hides
- [ ] Dropdown shows "Select a Note" + your notes
- [ ] ➕ → creates note → textarea blank
- [ ] Type in textarea → persists
- [ ] ✏️ → renames note
- [ ] 🗑 → confirms → deletes note
- [ ] Toggle back to Lists → grid returns with same data
- [ ] Toggle back to Notes → last note still selected
- [ ] Refresh while in Notes → still in Notes view
- [ ] Drag the resize handle → textarea grows/shrinks

---

## 6. Speech

- [ ] Press ▶ → speech starts, timer runs
- [ ] Press again → pauses
- [ ] Press again → resumes from pause point
- [ ] Press ⏹ → stops, timer resets
- [ ] ⏪ jumps back ~5 words
- [ ] ⏩ jumps forward ~5 words
- [ ] 🔁 → when speech ends, it restarts
- [ ] Change speed slider → applies immediately (restarts from current position)
- [ ] Open Voices accordion → voice list populated
- [ ] Gender filter narrows the list
- [ ] Search box filters voices
- [ ] Change voice → next read uses the new voice

---

## 7. Exam

- [ ] Grid has at least 3 rows with both cells filled
- [ ] Click Start Test → grid hides, exam appears
- [ ] Counter shows "Question 1 · 0 correct / 0 answered"
- [ ] Click an answer → feedback appears, Next button enables
- [ ] Click Next → advances to next question
- [ ] Switch modes mid-exam → current question re-renders in new mode
- [ ] Direction toggle → remaining questions in new direction
- [ ] Answer all questions → complete card appears with score
- [ ] Complete card shows missed items
- [ ] Click "Back to List" → returns to grid
- [ ] Open Notes → "Results" note contains this test's entry
- [ ] Take a second test → Results note appends (doesn't overwrite)

---

## 8. Refresh Behavior

With the app in each of these states, refresh and verify:

- [ ] Grid view → returns to Grid view
- [ ] Notes view → returns to Notes view with same note
- [ ] Exam in progress → ??? (currently untested, known issue)
- [ ] Theme is preserved
- [ ] Language is preserved
- [ ] Active list/note is preserved

---

## 9. Theme & Language

- [ ] Click theme toggle → switches dark ↔ light
- [ ] Grid, sidebar, buttons all styled correctly in both themes
- [ ] Click EN → switches to VI
- [ ] All labeled text translates
- [ ] Refresh → theme and language persist

---

## 10. Mobile

Open in a phone-sized viewport (DevTools → Toggle device toolbar → iPhone 12).

- [ ] Top bar shows hamburger icon
- [ ] Sidebar is collapsed by default
- [ ] Tap hamburger → sidebar slides open
- [ ] Sidebar covers the workspace on mobile
- [ ] Tap hamburger again → collapses
- [ ] Mobile playback bar visible at bottom
- [ ] ☰ button in playback bar → opens speed popup
- [ ] Pick a speed → popup closes, speed applies
- [ ] Grid scrolls internally when tall
- [ ] Start Test stays pinned at bottom

---

## 11. Console Cleanup

- [ ] No red errors during any of the above
- [ ] No warnings from the app itself (browser warnings are fine)

---

## 12. Regression Spot-Checks

After a CSS change, verify these still look right:

- [ ] Top bar height and padding
- [ ] Sidebar width (280px on desktop)
- [ ] Grid header bar styling
- [ ] Start Test button styling
- [ ] Exam answer button borders
- [ ] Mode tab animated underline

---

## When a Test Fails

1. Note the exact steps that reproduced it
2. Screenshot or Console output
3. Check which file likely owns the behavior (see **ARCHITECTURE.md § 4**)
4. Check if the bug is state-related: `window.__recallrx_state__()`
   prints the current state
5. Fix, then re-run this checklist from § 2 onward

---

## Known Issues (not bugs — deferred)

- **Refresh during an exam** — currently writes partial results and
  returns to grid. Planned change: restart exam fresh (see HANDOFF.md § 7).
- **Storage full** — no user-facing error if localStorage hits its quota.
  Not currently handled.
- **Large lists (500+ rows)** — the grid renders all rows; may feel slow.
  Not a priority.