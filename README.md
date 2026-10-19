# Job Finder

A personal job-search assistant that runs on your own Google account, with no paid services and no API keys.

- **Gemini Spark** searches job sites every morning and writes what it finds into a private Google Sheet.
- **This app** (Google Apps Script) scores each job against your CV, emails you the best new ones (never the same job twice), tailors your CV and cover letter for a job on request (using only facts already in your CV), and sends email applications after you confirm.

To run the checks: `node tests/run.js`. Rules for Claude are in `CLAUDE.md`.
