# Job Helper agent instructions

- This is a separate Google Apps Script job-search project. The default build is private; an optional invitation-based shared pilot uses one hosting/sending account, separate site logins, per-user records, and approval by the logged-in user. Keep shared sign-in disabled until the live two-account pilot passes. Do not change DVCS, reuse its folders, access grants, recipients, or deployment.
- No additional subscription, paid fallback, hosting requirement, or billing setup. Keep a complete local-first workflow when AI is unavailable.
- Use the existing checkout. Cloud tasks are isolated; do not create worktrees unless the user explicitly requests one.
- Keep candidate facts distinct from raw CV text. A save is not an approval. Never invent a qualification, employer, employment date, achievement, recruiter address, or submission result.
- AI processing is off by default and needs a visible owner consent choice. Send only selected approved facts and the relevant posting. Do not use consumer Google subscription cookies as API credentials.
- Authenticated API requests use native owner identity or verified invitation/session identity. Set/reset actor context per request and enforce tenant ownership in Sheet access, properties, downloads and files. Unauthenticated endpoints are limited to neutral, throttled login requests/verification. Setup and recovery need native owner identity; private helpers end with `_`.
- Use `drive.file` for app-created files. Do not broaden Drive scopes or make the app/files public to work around an integration failure.
- Applications, outreach, and follow-ups need approval for each message. External sending stays off until a test-to-self was accepted and the owner confirms receipt. Daily automation emails each verified account only its own briefing; it never sends employer messages. Shared sending/AI need host gates plus user consent and approvals.
- Preserve source CV files and version/fact snapshots. Keep credentials, `.clasp.json`, CVs, correspondence, and private attachments out of Git/logs. Do not read credential files to discover their values.
- Files are modular at the repository root. `npm run build` creates the three-file Apps Script deployment bundle without preview fixtures.
- Required checks: `npm test`, `npm run check`, and `npm run test:browser` after related logic/UI changes. Run `npm run test:documents` after document format changes when its tools are available. Report real, mocked, blocked, and unrun checks separately.
- Read docs/HANDOVER.md and VALIDATION.md before continuing. Maintain those documents, the owner guide, and release history.
- Deployment requires the user's explicit instruction for a concrete reviewed version. Do not deploy over another project or claim local/mocked tests prove live Google behavior.
