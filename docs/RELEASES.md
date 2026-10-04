# Release history

## 1.0.0 — 2 October 2026 — local development, not deployed

First private personal job-search implementation: approved facts, manual employer postings, evidence maps, local application packets, deterministic DOCX, Google document/PDF export code, tracking and reminders. Adds optional public ATS feeds/Gemini, explicit processing consent, owner feature controls, purpose-specific mail, and an approval/test-to-self gate for external sending.

Includes source/version snapshots, deduplication, stale posting checks, editable drafts, safe delivery recovery, mocked server acceptance tests, Chromium workflows, real document-render QA, and a three-file deployment bundle. Live Google authorization and pilot remain pending; no previous deployment was replaced.

## Installer addition — 3 October 2026

Added optional local automated installation via pinned Google clasp 3.4.1: new standalone project only, upload whitelist, owner-only manifest check, project-ID marker, resumable initial deployment, and local-only ignored credentials. This reduces code copying; Google sign-in, API enablement if requested, and first-run app permissions still require the owner. Bundle dry check, installer syntax, app syntax/manifest checks and ZIP CRC checks passed. No Google login, project creation, deployment, or Windows launcher execution was performed. Existing 53 backend/55 browser results apply to unchanged application code.

## 1.0.1 — 3 October 2026 — CV extraction fix, not deployed

Groups exact excerpts by CV section, employment role and wrapped entries. Contact headers no longer become experience, mixed summaries stay review-only, short skills/languages are retained, and column-ordered education is flagged instead of falsely reconstructed. Displays source/context/warnings. Re-extraction archives untouched legacy auto drafts and preserves approvals/edited facts. Adds 14 parser acceptance tests and three browser checks. Tested the uploaded PDF in two extraction orders and source/contact preservation on 14 public MIT sample pages. Shared hosting/user isolation remains pending.

## 1.1.0 — 3 October 2026 — shared-user implementation, not deployed

Invitation-based sign-in, isolated records/properties/files, authenticated exports, Access management/revocation, per-user approvals and mail limits through one hosting account. Adds shared digests and scoped application/outreach reply metadata, with concurrency-safe updates. Host/user AI and mail permissions remain separate. Default deployment is private; optional shared manifest has identical scopes. 92 backend tests and 70 Chromium checks pass. Live Google pilot remains pending.
