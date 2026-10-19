# Client-Ready: BDO formatting add-in for PowerPoint

A pane on the right of PowerPoint with one-click buttons:
- **Fix all (safe fixes)**: brand font, titles, colours and text tidy-up in one go.
- **Brand check + client-ready score**: lists what breaks the rules, slide by slide, with "go to slide" buttons.
- **Unify titles**: every title in the BDO position, 26 pt BDO red, not bold, in sentence case (acronyms kept).
- **Make body text size consistent**: one body size and font. Footers and source lines are left alone.
- **Change fonts**: headings and body separately, for the whole deck or selected slides.
- **Left-align justified text, remove double spaces.**
- **Snap colours to BDO palette**: e.g. Office red, old BDO red and navy go to the nearest BDO colour.
- **Remove empty text boxes**: lists them first and deletes only after you confirm.

Rules: `docs/BRAND_RULES.md`. Why these features: `docs/STUDY_FINDINGS.md` (27 real proposals measured).

Every action shows what changed and what was skipped, and can be undone with **Ctrl+Z**.

> The brand rules are drafted from the BDO 2023 guidelines and template and are **awaiting approval** (see `docs/BRAND_RULES.md`). Try it on copies of decks first.

![Brand check on the synthetic test deck](docs/screenshot-brand-check.png)

## Install (try in this order)
1. **PowerPoint on the web** (easiest for testing): open a deck → **Home → Add-ins → More Add-ins → My Add-ins → Upload My Add-in** → choose `manifest.xml`.
2. **PowerPoint desktop**: the same route (older versions: **Insert → Get Add-ins**). If "Upload My Add-in" is missing or greyed out, the firm's policy has turned it off. Don't work around it; use route 3.
3. **IT central deployment**: give IT `docs/IT_NOTE.md` and `manifest.xml`. They upload it in the Microsoft 365 admin centre, and it appears for you automatically.

The add-in loads from `https://kushalwork7111-svg.github.io/JOB-Helper/`. GitHub Pages must be turned on for this repo (Settings → Pages → Deploy from branch `main`, folder `/ (root)`). On a free GitHub plan, Pages needs the repository to be public. That's fine, because nothing confidential is stored here.

**Why not Google Apps Script?** Apps Script web apps are served inside Google's sandboxed iframes. Office add-ins must run their own page directly, and inside those frames Office.js cannot connect to PowerPoint, so the pane would stay blank. Use GitHub Pages or Firebase Hosting (both free, static HTTPS).

## For developers
- `node tests/run.js`: unit tests for `src/rules.js`.
- `python3 tests/make_test_deck.py`: rebuilds the synthetic messy deck `tests/decks/messy.pptx`.
- Rules for working on this repo: `CLAUDE.md`.
