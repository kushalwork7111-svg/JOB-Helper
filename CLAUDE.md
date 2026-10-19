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
- Phase 1 (brand study): done. Rules drafted from the BDO 2023 guidelines + PowerPoint template; 27 proposals measured (`docs/STUDY_FINDINGS.md`). **Waiting on owner approval** of `docs/BRAND_RULES.md` (body size 12 pt, min 9 pt, house terms). `brand.json` keeps `"approved": false` until then.
- Phase 2–3: built (titles, fonts, body size, brand check with score, colour snapping, tidy text, remove empty boxes with confirm, Fix all). Tested on a mocked PowerPoint only; not yet installed in real PowerPoint.
- Hosting: Google Apps Script was requested but cannot host an Office add-in (it wraps pages in sandboxed iframes, so Office.js cannot reach PowerPoint). Waiting on owner to pick GitHub Pages (needs a public repo) or Firebase Hosting.
- Proposal decks and the BDO template are confidential: analyse them only in the scratchpad, never commit them or their text. Only aggregate counts go in docs/.

## Releases
- 0.2.0: real BDO rules (Trebuchet MS, 26 pt red sentence-case titles, palette with tint rules), Fix all, Snap colours, Tidy text, Remove empty boxes (confirm), client-ready score, leftover-draft-text check.
- 0.1.0: skeleton, Unify titles, Change fonts (heading/body), Consistent body size, basic Brand check.
