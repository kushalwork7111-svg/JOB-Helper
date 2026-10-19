# Job Finder: rules for Claude Code
Owner: Kushal (not a developer). Explain changes in plain business language first; confirm before sending email, applying or changing live data.
- Research engine: Gemini Spark (skill job-finder-v1). It writes rows only; it never edits Config. "Run finished" = Run Log row with Status DONE.
- The app (Google Apps Script, src/) scores jobs, emails alerts, builds tailored CV files and sends applications only after the owner confirms.
- Never invent CV facts; groundingProblems_ must pass before any file is sent.
- No API keys, no paid services, no external AI calls from code.
- One web-app deployment, always updated in place: clasp deploy -i <DEPLOYMENT_ID>. Record each release (version, date, what changed, recovery version) at the top of this file.
- Before every deploy: node tests/run.js must pass. Never commit .clasprc.json or sign-in codes.
- Sheet must stay Restricted (owner only) so Gemini runs unattended.

## Releases
| Version | Date | What changed | Recovery version |
|---|---|---|---|
| 0.1 | 2026-10-19 | Phase 1: repo, starter app, local test harness (not yet deployed) | none |

## Layout
- `src/` is the clasp root: `appsscript.json`, `Code.gs`, `Index.html`. Create the project with `clasp create --type standalone --rootDir src --title "Job Finder"`.
- `tests/harness.js` runs `src/*.gs` in Node against in-memory fakes of SpreadsheetApp, MailApp, DriveApp, DocumentApp, PropertiesService, Utilities, ScriptApp, UrlFetchApp and Session. `tests/run.js` holds the checks.
- `prompts/spark_skill/job-finder-v1/SKILL.md` is uploaded to Gemini as a skill; `prompts/gemini_tasks.md` holds the three task texts.

## Deploy routine
bump `APP_VERSION` → `node tests/run.js` → `clasp push --force` → `clasp deploy -i <DEPLOYMENT_ID> -d "…"` → open the live page → commit and push → add a row to Releases above.

## Phase status
1. Repo and harness: done.
2. Setup and sheet: next (needs owner's clasp sign-in and master CV).
3–9: see the build brief.
