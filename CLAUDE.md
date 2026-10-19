# Client-Ready PowerPoint add-in: rules for Claude Code

Owner: Kushal (BDO India DVCS, not a developer). Explain changes in plain business language first.

- Office.js task-pane add-in, plain HTML/JS, hosted as static files over HTTPS. No server, no external calls, no API keys, no AI services.
- brand.json holds approved generic rules only. Never commit or host client content, proposal files or client logos. Test decks are synthetic (`tests/make_test_deck.py`).
- Only Microsoft-supported install routes; never advise bypassing IT policy. IT note in docs/IT_NOTE.md.
- Every action: scope (deck/selected), result message with counts and skipped items, no deletion without confirm, undo-friendly batching (one `PowerPoint.run`, one final `sync` for writes).
- Guard newer APIs with isSetSupported; minimum PowerPointApi 1.4.
- Pure logic lives in `src/rules.js` (works in the browser and in Node) and is unit-tested.
- Before every push: `node tests/run.js` passes; bump VERSION in taskpane.js; record the release below.

## Layout
- `manifest.xml`: install file (points at the hosted `taskpane.html`).
- `taskpane.html`, `taskpane.js`, `src/rules.js`, `brand.json`, `assets/`: the hosted add-in.
- `docs/BRAND_RULES.md`: plain-English rules table the owner approves; `brand.json` mirrors it.
- `tests/run.js`: Node unit tests. `tests/make_test_deck.py`: builds `tests/decks/messy.pptx`.

## Status
- Phase 1 (brand study): **waiting on owner** for the BDO brand guidelines PDF and proposals-folder access. `brand.json` has `"approved": false` and placeholder values; the pane shows a warning banner until approved.
- Phase 2 (skeleton + core three): built, not yet installed on a real PowerPoint.

## Releases
- 0.1.0: skeleton, Unify titles, Change fonts (heading/body), Consistent body size, basic Brand check.
