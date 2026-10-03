# Job Helper agent instructions

- This is a separate Google Apps Script job-search project. The current tested boundary is single-owner/private. The agreed next shared design uses one hosting/sending account, separate site logins, per-user records, and approval by the logged-in user; do not expose the private build before those controls are implemented. Do not change DVCS, reuse its folders, access grants, recipients, or deployment.
- No additional subscription, paid fallback, hosting requirement, or billing setup. Keep a complete local-first workflow when AI is unavailable.
- Use the existing checkout. Cloud tasks are isolated; do not create worktrees unless the user explicitly requests one.
- Keep candidate facts distinct from raw CV text. A save is not an approval. Never invent a qualification, employer, employment date, achievement, recruiter address, or submission result.
- AI processing is off by default and needs a visible owner consent choice. Send only selected approved facts and the relevant posting. Do not use consumer Google subscription cookies as API credentials.
- Native Google owner-only access is the current authentication boundary. Keep every callable mutation behind `requireOwner_` through `api`; private helpers end with `_`.
- Use `drive.file` for app-created files. Do not broaden Drive scopes or make the app/files public to work around an integration failure.
- Applications, outreach, and follow-ups need approval for each message. External sending stays off until a test-to-self was accepted and the owner confirms receipt. Daily automation only emails the owner.
- Preserve source CV files and version/fact snapshots. Keep credentials, `.clasp.json`, CVs, correspondence, and private attachments out of Git/logs. Do not read credential files to discover their values.
- Files are modular at the repository root. `npm run build` creates the three-file Apps Script deployment bundle without preview fixtures.
- Required checks: `npm test`, `npm run check`, and `npm run test:browser` after related logic/UI changes. Run `npm run test:documents` after document format changes when its tools are available. Report real, mocked, blocked, and unrun checks separately.
- Read docs/HANDOVER.md and VALIDATION.md before continuing. Maintain those documents, the owner guide, and release history.
- Deployment requires the user's explicit instruction for a concrete reviewed version. Do not deploy over another project or claim local/mocked tests prove live Google behavior.
