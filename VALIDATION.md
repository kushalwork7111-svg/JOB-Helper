# Validation — 2 October 2026

This is a locally prepared first version, **not a published or live-validated Google deployment**. The separately supplied DVCS handover was used as a build brief; no DVCS source or data was read or modified.

## Passed

| Check | Outcome | What it establishes |
| --- | --- | --- |
| Frozen dependency install | `npm ci --cache /tmp/job-helper-npm-cache --ignore-scripts --no-audit --no-fund` passed | The pinned development dependencies install without changing the lockfile |
| Server acceptance tests | **53 passed, 0 failed/skipped** with `npm test` | Local fact approval/import/matching/packets; all API routes reject another user; feature/consent gates; salary/stale status; duplicate/uncertain sends; follow-ups; attachments; private payloads |
| Syntax/manifest checks | `npm run check` passed | All 13 server modules and client parse; template includes exist; deployment is MYSELF and uses drive.file rather than full Drive |
| Chromium workflows | **55 passed, no page errors** with `npm run test:browser` | Real client navigation, edits, consent/feature visibility, manual import, fact approval, packet creation, questions, recorded submission, approval block, and draft preservation against mocked Google services |
| Responsive checks | Six pages and opportunity/application dialogs at **320, 390, 768, 1024, 1366px** | No measured page or dialog horizontal overflow in the tested views |
| Actual document QA | Three DOCX files opened/rendered successfully | Same production OOXML generation functions; valid ZIP/XML, exact source text, dates, and qualifications preserved |
| Pagination and visual review | Short CV 1 page, long CV 4 pages, letter 1 page | LibreOffice-generated PDFs preserve all paragraphs without truncation; rendered sample pages were inspected |
| Deployment packaging | `npm run build` and ZIP verification passed | Consolidated Code.gs, Index.html, private manifest, START-HERE.txt; valid CRCs and no demo bridge/fixtures |
| Repository checks | `git diff --check` passed | No whitespace errors; generated artifacts/dependencies/auth files are ignored |

The browser tests call the real application API/functions inside the Node Google-service harness. They are not only screenshots, but their Google services are still mocked. No real email, application, outreach, AI processing, or private CV import occurred.

Document QA creates actual local DOCX files from the production `docxParts_` output and converts them with LibreOffice. It does **not** establish that Google Drive conversion, Google PDF rendering, Apps Script ZIP handling, or Drive permissions work in the owner's account. Test those during the bounded Google pilot.

## Blocked or unrun live

| Operation | Status / required prerequisite |
| --- | --- |
| Shared ChatGPT URL | Initial request returned 403; user-provided handover was read instead |
| Public Greenhouse / Lever / Ashby API requests from this cloud machine | Proxy CONNECT 403; cloud network does not permit these destinations yet. No conclusion about the boards' contents or real API responses can be drawn |
| New Google Apps Script deployment and OAuth | Unrun. Outbound-identity manifest has zero connections; no usable Google connection is configured. Environment variable presence alone was not treated as authorization |
| Private Sheet/folder creation, PDF OCR, editable Google Docs and Google PDF export | Code implemented, unrun live; owner OAuth and Drive API v3 are required |
| Real Gmail delivery / reply metadata / scheduled triggers | Unrun; requires owner authorization and test-to-self pilot |
| Gemini / gateway quality, availability, quota and grounding | Unrun. Optional and off by default; needs a documented endpoint/key and explicit processing consent. No paid fallback or billing requirement |
| Employer forms / LinkedIn submission | No generic automated submission is implemented. Supported workflow is a prepared user handoff, followed by user-confirmed status |

## Saved reusable cloud configuration

The environment draft successfully saved:

- `install_script`: the tested frozen dependency installation in `/workspace/JOB-Helper` with a writable cache and lifecycle scripts disabled.
- `start_skill`: existing checkout/no worktree guidance, checks, optional fictional preview readiness, bundle build, and privacy/approval boundaries.
- Network domain additions: `boards-api.greenhouse.io`, `api.lever.co`, `api.ashbyhq.com`, `generativelanguage.googleapis.com`, and `ai.google.dev`.

Saving the draft does not apply its network policy, publish a cloud snapshot, execute scripts, or deploy Google Apps Script. Domain additions need environment-settings review/application before another live feed check. The saved install command was executed separately and passed.

## Evidence artifacts

Generated under the ignored `artifacts/` directory:

- Job-Helper-Apps-Script.zip and deployment/ — owner-reviewable Google bundle.
- dashboard-desktop.png / dashboard-mobile.png — explicitly fictional UI preview captures.
- browser-report.json — the 55 checks and scope.
- document-qa/ — three actual DOCX/PDF pairs, renders, and report.json.

The remaining step is a bounded owner-authorized pilot in a **new private** Google project. See docs/HANDOVER.md for pilot/rollback and docs/OWNER_GUIDE.md for the first workflow. Do not treat the mocked test results as proof of live application relevance or Google service readiness.

## Installer addition — 3 October 2026

Added optional local automated installation via pinned Google clasp 3.4.1: new standalone project only, upload whitelist, owner-only manifest check, project-ID marker, resumable initial deployment, and local-only ignored credentials. This reduces code copying; Google sign-in, API enablement if requested, and first-run app permissions still require the owner. Bundle dry check, installer syntax, app syntax/manifest checks and ZIP CRC checks passed. No Google login, project creation, deployment, or Windows launcher execution was performed. Existing 53 backend/55 browser results apply to unchanged application code.

## 1.0.1 parser QA — 3 October 2026

- **67 backend tests passed** (14 new parser/migration/provenance checks; no skipped tests).
- **58 Chromium checks passed**, including extraction warnings, blocked approval for review-only text and recategorization/approval.
- Real uploaded PDF tested via Poppler in layout and flow order: two complete dated employment headers, eight experience/project excerpts, five technical skills, three languages and two certifications. Layout order retains six education rows and the full wrapped B.Com institution; flow order preserves the shuffled table in a review block. Mixed summary is not a qualification. Source text remains exact; contact header is excluded.
- MIT CAPD public sample PDF (https://capd.mit.edu/resources/resumes/; linked https://cdn.uconnectlabs.com/wp-content/uploads/sites/123/2021/08/sampe-resumes-capd.pdf): 14 pages / 323 extracted drafts checked for exact source preservation, contact exclusion and non-empty parsing. This is not a full accuracy benchmark; sparse side headings and complex columns may still need review. Synthetic regressions cover margin headings, unicode bullets, CRLF, wrapped education, dates, long entries and education column order.
- Syntax/manifest, deployment packaging, ZIP checks and installer dry check passed. No real email/AI call happened. Document formatting functions are unchanged, so document rendering QA was not repeated.
- Private PDF/text stay outside Git; generated aggregate report is ignored at `artifacts/cv-parser-report.json`.
- Google OCR, source update, redeployment and live site QA remain unrun; cloud has no Google deployment authorization. The current version remains single-owner/private; agreed central-account multi-user isolation is pending.

## 1.1.0 shared-user QA — 3 October 2026

**92 backend tests passed**, including production tenant-aware Sheet read/write functions against a minimal Sheet adapter. Covers invitation/code limits and one-time use, token expiration/revocation, per-user profiles/settings/jobs/facts/documents/folders/property isolation, spoofed IDs/tenant values, legacy owner-only rows, authenticated file downloads, host permissions, mail gates/approval/limits/candidate identity, strict sender/reference reply filtering, separate outreach replies, concurrent note/stage preservation, private shared scheduling, and duplicate per-user digest prevention.

**70 Chromium checks passed**: original app workflows/responsiveness plus owner invitation/Access UI, anonymous login/no-owner-data, actual code verification against the mocked backend, own-profile-only view, hidden host controls/disabled credential input, shared settings at 320/390/768px, and logout clearing sessions/private drafts/dialogs. No real email/code/invitation, employer submission or AI request occurred.

Syntax/manifest checks and ZIP CRC/file checks passed. Both manifests execute as host and have identical OAuth scopes; the default is private. Optional shared pilot file serves a login shell to visitors, with data authorization enforced on the server. The updated parser remains included; real PDF/source QA was repeated after additional inline-heading, merged-column and OCR-header fixes. Document formatting is unchanged, so rendering was not repeated.

Shared hosting, Google OAuth/code delivery, live Drive/Gmail behavior, trigger timing and real quotas are **unrun**. Do not treat mocked tests as live validation. No Google account is connected to the cloud; use docs/GOOGLE_ACCESS.md. Live pilot/rollback instructions are in docs/SHARED_SITE.md. Generated reports/private CVs/credentials stay out of Git.
