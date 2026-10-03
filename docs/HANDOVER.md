# Current handover — 2 October 2026

## Objective and decisions

Build a separate private Google Apps Script job-search app inspired by DVCS. The supplied handover clarified that DVCS uses optional Google AI Studio API access; no official subscription-backed “Gemini Spark” backend was identified. The user chose approval before every application/message and has no budget for additional subscriptions.

The selected first workflow is: CV → explicitly approved facts → manual official posting → local requirement/evidence map → factual packet → document export → user-confirmed submission → tracking/reminders. Automated board discovery and AI are optional. No DVCS files, folders, deployments, or data were accessed or changed.

## Implementation map

- Core.gs: preference normalization, gates, quote checks, shortlist, formatting.
- Store.gs: private Sheets tables and locking; idempotent initialization/schema additions.
- Candidates.gs: draft fact extraction, explicit approvals, local requirement mapping and preparation.
- Imports.gs: manual jobs, deduplication, user-confirmed open evidence, watchlist/dismissal.
- Applications.gs: local/optional AI packets, edits, confirmations, approved sends, idempotency, reply metadata, follow-ups, and manual delivery recovery.
- DocumentFormat.gs / Documents.gs / PrivateDrive.gs: deterministic DOCX, private app-created files, editable Docs conversion, and Google PDF export.
- Integrations.gs / Jobs.gs: optional Gemini/gateway and Greenhouse/Lever/Ashby listing adapters; bounded scans and open checks.
- Automation.gs: owner-only daily scan/digest and trigger lifecycle. No scheduled employer sends.
- Code.gs: owner-authorized API and web entry point.
- Index.html / Styles.html / Client.html: responsive dashboard, opportunities, pipeline, preparation, profile/facts, settings, draft preservation.
- tools/: safe fictional preview, deployment packaging, real DOCX/render QA.
- tests/: mocked Google server harness, acceptance checks, real Chromium UI workflows.

## Security and operations

Deploy Only myself / execute as owner. Personal data stays private. Drive scope is drive.file, limited to app-created files. Keys are Script Properties and never returned. Google-native identity replaces an unnecessary OTP/team system.

AI is off by default and requires both owner feature activation and external processing consent. Application drafting sends only approved facts. There is no paid provider fallback. The optional AI guard checks source anchoring, numeric claims, certain qualifications, and URLs; it is partial verification, not a semantic guarantee.

External email is off by default. An accepted owner test digest plus owner-confirmed receipt is required to enable it. Each employer application, outreach, and follow-up still needs a separate approval. Contacts need user-verified affiliation/source. LinkedIn and arbitrary forms use manual handoffs.

Delivery state is claimed before sending. Uncertain messages do not automatically retry. Completion updates merge with the latest record to preserve concurrent notes/outreach. Manual recovery helpers require owner identity and wait for potentially running sends.

## What remains external

No Google outbound identity is configured in the cloud manifest. No new Google project is deployed; OAuth, Google Drive conversions, real Gmail delivery, scheduled runs, and AI quality are untested live. The shared chat initially returned 403; the user's pasted handover was read instead.

Cloud proxy requests to employer APIs are denied with CONNECT 403. A network-only draft adding boards-api.greenhouse.io, api.lever.co, api.ashbyhq.com, generativelanguage.googleapis.com, and ai.google.dev was saved for environment-settings review; this is not proof it was applied. Retry only after a meaningful runtime/configuration change.

Pending user inputs: target roles/levels/sectors/locations and constraints; owning Google account and first permitted source; optional AI consent. All remain configurable. No CV, target data, credentials, or private correspondence were committed.

## Next bounded pilot and rollback

1. Owner reviews the built deployment bundle and authorizes a NEW private Google project.
2. Save an initial deployment version and backup the new workbook before making subsequent schema/data changes.
3. Test one non-confidential candidate profile and one official manual job first; then use the actual CV only after privacy review.
4. Check Google Docs/DOCX/PDF output, private-file access, owner identity, self-email, and a reminder.
5. Test one selected employer feed and optional AI only after allowed access/consent. Do not send externally during the pilot.
6. After owner approval, enable external sending for individually approved messages.

Rollback code by selecting the previous version in Manage deployments. Disable daily briefing to remove the app's own trigger. Data is preserved separately; use the private Sheet backup for data rollback. Never delete or restore over DVCS.

See VALIDATION.md for exact test scope and docs/OWNER_GUIDE.md for setup without jargon.

## Installer addition — 3 October 2026

Added optional local automated installation via pinned Google clasp 3.4.1: new standalone project only, upload whitelist, owner-only manifest check, project-ID marker, resumable initial deployment, and local-only ignored credentials. This reduces code copying; Google sign-in, API enablement if requested, and first-run app permissions still require the owner. Bundle dry check, installer syntax, app syntax/manifest checks and ZIP CRC checks passed. No Google login, project creation, deployment, or Windows launcher execution was performed. Existing 53 backend/55 browser results apply to unchanged application code.

## 1.0.1 — 3 October 2026: CV grouping and current access

Cloud recovered after user resaved it; filesystem and private CV attachment became available. Fixed line-only keyword classification with section-aware source spans, wrapped education/experience grouping, short skill/language extraction, employment context, and review-only ambiguous text. Untouched legacy auto drafts are archived on explicit re-extraction; approvals and user edits stay intact. No AI or Google sending is used for extraction.

Validation: 67 backend tests, 58 browser checks, syntax/manifest, package build and installer dry check passed. Actual uploaded PDF was checked in Poppler layout/flow order. Six complete education rows in layout order; one review block when column-ordered. Two dated employment entries, eight project/responsibility excerpts, five technical skills, three languages and two certifications preserved. Public MIT sample PDF: 14 pages, 323 drafts checked for source preservation, contact exclusion and non-empty parsing; not a per-fact accuracy benchmark. Google OCR output itself is not yet tested.

Shared-site requirements confirmed by user: one Google account hosts/sends, separate site logins, users see only their own records, and the logged-in user approves their own outgoing messages. This architecture is pending; current app remains owner-only and must not be made public. No consumer Google subscription API was introduced.

No clasp authorization/Google outbound identity exists in cloud. Local Codex + installer folder is the supported account-access route described in docs/GOOGLE_ACCESS.md. Do not ask for cookies/tokens in chat or reselect a DVCS project. The live Google site is still running its previous release until an authorized deployment update.
