# Job Helper

A Google Apps Script website with a private default and an optional invitation-based shared pilot for CV analysis, evidence-based job matching, an application pipeline, daily briefings, approved outreach, reminders, and interview preparation.

The app runs on your Google account. Google Sheets holds its records and a private Drive folder holds uploaded CV files. It needs no web server, Firebase project, additional subscription, or billing setup. Local matching and drafting work without AI. Optional AI free allowances can change; no paid fallback is configured.

## Features

- Upload PDF/text CVs or paste CV text. Extract verbatim draft excerpts locally, review their evidence, and explicitly approve facts for reuse. CV text saves are retained as master versions.
- Configure roles, locations, remote eligibility, minimum annual salary/currency, posting age, exclusions, fit score, and stretch-role inclusion. Seniority, employment type, industry, and stated work authorization inform AI assessment; they are not independently verified hard filters.
- Fetch public employer postings from Greenhouse, Lever, and Ashby. Grounded Gemini search can discover candidate boards; board access is verified before suggesting them. Search coverage depends on configured boards.
- Explain local fit using a requirement-to-approved-fact map. Optional Gemini matching checks CV/posting quotes against their source. Identify transferable skills, FDD gaps, and targeted learning plans. Scores are estimates, not hiring probabilities.
- Flag unknown salaries, dates, and remote country restrictions. Never guess currency conversion or substitute a posting update date for the original publication date.
- Check the live employer board before preparing or sending an application. Dashboard open checks expire after 24 hours.
- Prepare factual local cover letters, screening questions, resume suggestions, technical exercises, and interview questions. Retain the local draft if optional AI fails its factual guard or hits an outage.
- Export ATS-friendly CVs and letters to DOCX/PDF with editable Google Docs and approved-fact snapshots. DOCX is generated deterministically; PDF is exported through Google Drive. Attach the original CV or a selected tailored CV export to an email application.
- Keep shortlist, watchlist, and dismissed opportunities without deleting history. Record confirmed application stage changes in the application history.
- Send email applications with an optional original CV attachment only after approval, answered screening questions, and confirmation of an employer-provided recipient address. Screening answers are included in the email.
- Prepare professional email outreach and short LinkedIn notes. Email requires approval; you copy and send LinkedIn notes on LinkedIn.
- Track form submissions you confirm, replies, interviews, offers, and reminders. Follow-ups require approval and a no-reply check.
- Scan boards and email your own account a daily digest. Scheduled automation never contacts employers.

## Submission and accuracy limits

**Arbitrary employer forms cannot be automatically submitted by this Apps Script app.** Public posting APIs are listing APIs; submission endpoints often require employer-side credentials. Login, CAPTCHA, custom questions, and upload requirements vary. The app opens the employer form and provides your prepared packet. You complete the form and record its confirmation. A future authorized browser integration must be built and tested for supported sites.

Email accepted by Google appears as **Email sent**, not confirmed employer receipt or form submission. A live employer listing confirms that a job is listed; it cannot guarantee the position is unfilled. Reply sync searches inbox metadata for the subject reference; changed subjects and portal submissions need manual updates. Detected replies may include acknowledgements, so review them yourself.

AI drafts and learning resources need your review. Suggested material URLs are visibly unverified. The agent does not invent qualifications, recruiter emails, or submission outcomes. It attaches your original CV unchanged; resume suggestions do not rewrite that file.

## Deploy to Google Apps Script

1. Run `npm run build` to create **artifacts/Job-Helper-Apps-Script.zip**, then extract it. The bundle contains only `Code.gs`, `Index.html`, `appsscript.json`, and `START-HERE.txt`; no test fixtures or personal data.
2. Create a **new separate** standalone project at [Google Apps Script](https://script.google.com/) using your own account. Replace the default **Code.gs** with the bundled Code.gs. Do not use or overwrite DVCS.
3. Create an HTML file named **Index** and copy the bundled Index.html. The bundle already includes its styles and browser code. Alternatively, use all root `.gs` files plus Index/Styles/Client from the modular source; do not mix the two layouts.
4. In Project Settings, enable showing `appsscript.json`; replace its contents with this repository's manifest. Add **Drive API v3** under Services if it is not already present. If using a standard Cloud project, enable the Drive and Gmail APIs in that project too.
5. Run **setupJobHelper** in the editor and authorize your account. It creates a private spreadsheet and CV folder and preserves existing setup on reruns. Keep these files private.
6. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Only myself**. Open the deployed URL while signed into that account. The default private installation rejects another or unidentified user. For the optional invitation-based shared pilot, follow docs/SHARED_SITE.md.
7. Add/save your CV and contact details. Extract draft excerpts, edit categories and evidence, and approve only verified facts. Complete employment entries preserve chronology in CV exports.
8. Save your search criteria. Start with **Opportunities → Import a job**: paste an official employer posting and confirm it is open. Local matching requires no AI connection. Automated employer boards and optional AI can be enabled later.
9. Review the evidence and preparation, prepare a packet, answer questions, and export/review a CV and letter. Use the employer form and record its confirmation. The first pilot sends email only to your own account.
10. Use **Send my briefing** and check your inbox. To allow employer/contact emails, enable external sending and confirm test receipt in Preferences. Every message still requires approval. Enable daily briefing only when wanted; Google schedules within an hour window.

The manifest requests Google identity for owner checks, spreadsheet access, **drive.file** access limited to files this app creates, external requests, email sending, trigger management, and Gmail read access for optional reply metadata checks. It does not request full Drive or Documents access. Gmail's narrower metadata scope does not support the reference-based search query; the implementation requests only metadata while using the read scope. These permissions must be authorized in your Google account. No local test grants Google permissions.

To update the website, deploy a new version through **Manage deployments**. Old deployments retain old code until updated. Do not commit `.clasp.json`, keys, CVs, or private job-search records.

If you already use Google's `@google/clasp` CLI, create/clone the project from this directory, authorize your account, and run `clasp push`. Review `clasp status` first. `.claspignore` includes only root `.gs`, `.html`, and manifest files; Node tools, preview fixtures, and tests are excluded. Google authorization and deployment still occur under your account.

## AI connection

### Direct Gemini API

This is optional. Use a project's available free allowance in [Google AI Studio](https://aistudio.google.com/apikey), without enabling billing for this app. Save **GEMINI_API_KEY** in Script Properties or the Preferences password field. Enable both the AI feature and personal-data processing consent before any AI call. The UI returns only whether a key exists; requests use a header, not a key in the URL.

The default model is `gemini-2.5-flash`. Configure a supported model with JSON output support; employer discovery also requires Google Search grounding. API quotas, free-tier availability, billing, and grounding costs depend on your Google project and model. See [Gemini API billing](https://ai.google.dev/gemini-api/docs/billing).

**Google AI Pro consumer subscription access is not itself a Gemini API credential or a guarantee of API credits.** This app does not automate consumer sessions or use Google cookies as credentials.

### Your DVCS Deal Radar / “Gemini Spark” backend

The existing integration was not accessible during implementation. A gateway adapter is included, but it needs your actual endpoint documentation. This is not a claim that AI Pro includes a “Spark” API.

Set these Script Properties only for a trusted backend you authorize to receive your CV/job text:

| Property | Purpose |
| --- | --- |
| AI_GATEWAY_URL | Public HTTPS endpoint you control, without query credentials or redirects |
| AI_GATEWAY_TOKEN | Bearer credential for that endpoint |

A configured gateway takes precedence over direct Gemini. Remove `AI_GATEWAY_URL` to switch back; a gateway failure never silently sends data to another provider.

The gateway receives `POST` JSON with `Authorization: Bearer <token>`:

```json
{
  "model": "gemini-2.5-flash",
  "systemInstruction": "Task instructions and factuality requirements",
  "input": {"cv": "...", "job": {}},
  "responseFormat": "json",
  "grounding": false
}
```

Expected response:

```json
{"text":"{\"score\":78,\"fit\":\"stretch\",\"evidence\":[]}","grounding":[]}
```

For discovery, `grounding` is true and `responseFormat` is text, while the output text must still contain the requested JSON. The backend must implement actual search grounding or return an error. If DVCS uses a different contract, adapt `geminiText_` to its documented request/response structure. Never paste credentials into chat or repository files.

## Operations

- Each scan imports up to 35 new eligible jobs and performs up to 10 AI assessments within a runtime budget. Repeat scans continue the queue. Errors are reported; failed board reads do not mark jobs closed.
- Lever pagination stops at 1,000 postings and labels the board incomplete. Missing jobs on incomplete boards are not marked closed.
- Google Apps Script execution, email, external request, Sheet, and AI quotas apply. Scheduled runs can be delayed.
- Daily digests are deduplicated per date. Ambiguous delivery is not retried automatically; use **Send my briefing** after checking your mailbox.
- If an application email fails ambiguously, check Sent mail before retrying. In the editor, run a wrapper calling `resolveDelivery('application-id', true)` if found, or false only after confirming nothing was sent. Do not clear a send that is still running. Use the documented message-resolution helper for outreach/follow-up failures.
- Replies, interviews, offers, rejections, and withdrawals cancel follow-up reminders. Custom reminders and preparation tasks appear in your dashboard and digest.
- Disable daily briefing and save Preferences to stop scheduled automation. Delete the deployment to disable web access. Your private Sheet and folder remain until you delete them.
- Code files and configuration changes do not publish an app by themselves.

## Local validation

Node.js 20+ is required. The deployed app has no npm runtime dependencies. Playwright is a pinned development dependency for browser checks.

```sh
npm ci
npm test
npm run check
npm run preview
npm run test:browser
npm run build
```

The loopback preview on port 4173 uses explicitly fictional data. It cannot analyze a real CV, scan jobs, send email, or submit applications. Its files are excluded from Apps Script deployment.

Browser checks use a system Chromium (or `CHROMIUM_PATH`), or a Playwright browser installed with `npx playwright install chromium`. `npm run test:documents` also requires Python 3, LibreOffice, `pdftotext`, `pdfinfo`, and `pdftoppm`; it creates real DOCX fixtures, renders PDFs locally, and checks exact source text and pagination.

Tests cover the local-first workflow, matching, privacy, owner checks, approval, duplicate protection, follow-ups, reminders, owner digests and per-user shared digests using mocked Google services. They do not establish live OAuth, Google PDF/OCR conversion, Gmail delivery, or deployed employer API access. See [VALIDATION.md](VALIDATION.md), [the owner guide](docs/OWNER_GUIDE.md), and [the current handover](docs/HANDOVER.md).

## Optional installer with less copying

`npm run build` also produces `artifacts/Job-Helper-Automated-Installer.zip`. Extract it into a new folder on your own computer, install free Node.js LTS if needed, and run `Install-Windows.cmd` (Windows) or `node install-google.mjs` (Mac/Linux). It uses pinned Google clasp 3.4.1 to sign in, create a new project, upload the bundled files, and request a private deployment. Enable Apps Script API at https://script.google.com/home/usersettings if Google requests it. In the opened editor, run `setupJobHelper` once and approve Google permissions, then obtain the URL through Manage deployments. The manifest already declares Drive v3.

Clasp development authorization is separate from the app scopes and may cover managing Apps Script projects; review Google’s consent screen. Credentials stay in the extracted local folder: do not share it or paste tokens into chat. The installer refuses unrecognized project IDs and does not adopt DVCS. Google login and deployment remain untested live. Google AI Pro is separate from API access; no paid plan or API key is required for the local-first app.

## CV extraction correction and deployment access

Version 1.0.1 groups exact excerpts by section and employment entry, retains short skills, and flags ambiguous summaries/shuffled tables. After deploying, re-extract to archive untouched old drafts while keeping approvals and edits. See docs/OWNER_GUIDE.md. For account access without manually copying code, see [docs/GOOGLE_ACCESS.md](docs/GOOGLE_ACCESS.md). Version 1.1.0 implements the central-account shared-user model locally. Default installation remains private; the optional shared pilot requires live Google testing before enabling users.

## One Google account, separate site users (1.1.0)

The optional shared pilot provides invited-email sign-in, per-user records and authenticated downloads while the hosting Google account stores files and sends all emails. Each user approves their own messages. Applications/outreach/follow-ups carry the candidate identity; replies stay in the host account and only strictly matched metadata is returned to the relevant user. Google quotas are shared. AI and shared employer sending start disabled. See [docs/SHARED_SITE.md](docs/SHARED_SITE.md).
