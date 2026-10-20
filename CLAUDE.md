# Job Finder: rules for Claude Code
Owner: Kushal (not a developer). Explain changes in plain business language first; confirm before sending email, applying or changing live data.
- Research engine: Gemini Spark (skill job-finder-v1). It writes rows only; it never edits Config. "Run finished" = Run Log row with Status DONE.
- The app (Google Apps Script, src/) scores jobs, emails alerts, builds tailored CV files and sends applications only after the owner confirms.
- Never invent CV facts; groundingProblems_ must pass before any file is sent.
- No API keys, no paid services, no external AI calls from code.
- Dashboard link is public (owner's choice, 2026-10-20) behind a PIN. Every function the page can call must start with auth_(token); public names without a trailing underscore are callable by anyone with the link. Never store the PIN in the repo. `src/Local.gs` (gitignored) holds the one-time setup-code hash; a push from a fresh checkout removes it, which is fine once a PIN exists.
- One web-app deployment, always updated in place: clasp deploy -i <DEPLOYMENT_ID>. Record each release (version, date, what changed, recovery version) at the top of this file.
- Before every deploy: node tests/run.js must pass. Never commit .clasprc.json or sign-in codes.
- Sheet must stay Restricted (owner only) so Gemini runs unattended.

## Releases
| Version | Date | What changed | Recovery version |
|---|---|---|---|
| 0.5 | 2026-10-20 | Link made public with no Google sign-in (ANYONE_ANONYMOUS); first PIN created with a one-time setup code whose hash is in src/Local.gs (gitignored, pushed only) (Apps Script version 4) | 3 |
| 0.4 | 2026-10-20 | PIN lock: PIN screen, every page action needs an unlock (6 h), throttled guessing with owner email on lockout, change PIN in Settings; setup() owner-only. Link still private until owner creates PIN (Apps Script version 3) | 2 |
| 0.3 | 2026-10-20 | Settings panel on the dashboard (alert email, filters, scoring) with validation and test alert; new defaults Work Modes, Min Salary (LPA), Exclude Companies auto-added to Config (Apps Script version 2) | 1 |
| 0.2 | 2026-10-20 | First live deployment (Apps Script version 1). CV upload: reads any CV layout, previews, configures Profile/Config on confirm; tailored CV built from CV facts | none |
| 0.1 | 2026-10-19 | Phase 1: repo, starter app, local test harness (not yet deployed) | none |

## Layout
- `src/` is the clasp root: `appsscript.json`, `Code.gs` (sheet, scoring, alerts, tailoring, apply), `Cv.gs` (CV reader and CV import), `Settings.gs` (dashboard settings form), `Access.gs` (PIN lock for the public link), `Index.html`. Create the project with `clasp create --type standalone --rootDir src --title "Job Finder"`.
- `tests/harness.js` runs `src/*.gs` in Node against in-memory fakes of SpreadsheetApp, MailApp, DriveApp, DocumentApp, PropertiesService, Utilities, ScriptApp, UrlFetchApp and Session. `tests/run.js` holds the checks.
- CV reader: rule-based (no AI, no keys). Nothing about the owner's CV is hard-coded; the owner's CV lives only in their Drive and the Profile tab.
  `tests/cv_fixtures.js` (tuning set) and `tests/cv_holdout.js` (written after tuning, to check it generalises) are fictional CVs in common layouts.
  `node tests/cv_accuracy.js [tuning|holdout|all]` prints field-level accuracy. When a real CV is misread, add a fictional CV in the same layout to a set, then fix the reader.
- `prompts/spark_skill/job-finder-v1/SKILL.md` is uploaded to Gemini as a skill; `prompts/gemini_tasks.md` holds the three task texts.

## Live app
- Web app deployment ID: `AKfycbz0YCN95XGfwI78XI8WVCsMyzc2rCwnQoaCyovpzuJKmiz3-ynyBdOxBveEWxWlFXhU` (dashboard: https://script.google.com/macros/s/AKfycbz0YCN95XGfwI78XI8WVCsMyzc2rCwnQoaCyovpzuJKmiz3-ynyBdOxBveEWxWlFXhU/exec)
- Sheet "Job Finder Data" created by setup() on 2026-10-20 (link is in Script Properties SHEET_ID; owner has it).

## Deploy routine
bump `APP_VERSION` → `node tests/run.js` (run it on its own, never piped, so a failure stops the deploy) → `clasp push --force` → `clasp deploy -i <DEPLOYMENT_ID> -d "…"` → open the live page → commit and push → add a row to Releases above.

## Phase status
1. Repo and harness: done.
2. Setup and sheet: setup() run by the owner 2026-10-20; dashboard deployed. Next: owner uploads CV on the dashboard and sets Email To.
3–9: see the build brief.

## Sign-in for clasp in cloud sessions
Background processes do not survive session restarts, so `clasp login --no-localhost` cannot wait for the owner's reply.
The owner approved a helper that keeps the sign-in state on disk in the session scratchpad (never in this repo).
`clasp create` overwrites `src/appsscript.json` with Google defaults: restore it with `git checkout src/appsscript.json` before pushing.
