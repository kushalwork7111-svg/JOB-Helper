# Your first working job-search workflow

Start with one CV, one job, and one factual application pack. No AI subscription or API key is required.

1. Follow the bundle setup in README. Create a new private Google project; leave DVCS alone.
2. Save your CV and contact details in **My CV & profile**. You can paste text if PDF conversion is unavailable.
3. Click **Extract draft CV excerpts**. These are exact text excerpts, not verified facts. Review each, choose its category, supply evidence, and approve only true statements. Include complete employer/role/date entries and qualifications.
4. In **Preferences**, save the roles, locations, salary, and work arrangements you want. Unknown salaries can remain in view with a warning. AI is off by default.
5. In **Opportunities**, choose **Import a job**. Paste an official posting, its employer and role, and its description. Record only disclosed pay/dates. Confirm you opened the employer page and applications are accepted.
6. Review the evidence map. “Not evidenced” means you have not supplied an approved fact; it does not prove you lack the skill. Local scores are screening hints with low confidence. Check legal eligibility and essential qualifications yourself.
7. Choose **Prepare application**. Edit the letter, answer questions, and review the role-specific preparation exercises. The fact snapshot is frozen for that packet; changes to the fact bank do not silently rewrite old documents.
8. Export and review a CV and letter in DOCX/PDF. Plain layouts prioritize readability and parsing. Review full chronology; incomplete approved employment entries produce an incomplete CV. Exported files and editable Google Docs stay in your private app folder.
9. Complete the employer form with your reviewed packet, then record the actual confirmation in the application workspace. The app does not automatically complete arbitrary employer forms or LinkedIn messages.
10. For email applications, first send yourself a briefing and check receipt. Enable external sending only after that test. Select the original or a reviewed tailored CV attachment, confirm an official recipient address, and approve the individual email.

Daily briefings can scan configured employer boards and show pending reminders. They never submit applications or contact employers. Scheduled runs use Google quotas and hour windows.

To try optional AI later, use a documented free API allowance without billing setup, enable AI and processing consent, and test the saved connection. Quota failures retain local factual drafts. AI Pro consumer access is not itself an API key. Suggested learning links and AI wording still need review.

If delivery is uncertain, check Sent mail before retrying. The app blocks duplicates and has owner-only recovery helpers documented in README. Never resolve an ongoing send immediately.

## Optional installer with less copying

`npm run build` also produces `artifacts/Job-Helper-Automated-Installer.zip`. Extract it into a new folder on your own computer, install free Node.js LTS if needed, and run `Install-Windows.cmd` (Windows) or `node install-google.mjs` (Mac/Linux). It uses pinned Google clasp 3.4.1 to sign in, create a new project, upload the bundled files, and request a private deployment. Enable Apps Script API at https://script.google.com/home/usersettings if Google requests it. In the opened editor, run `setupJobHelper` once and approve Google permissions, then obtain the URL through Manage deployments. The manifest already declares Drive v3.

Clasp development authorization is separate from the app scopes and may cover managing Apps Script projects; review Google’s consent screen. Credentials stay in the extracted local folder: do not share it or paste tokens into chat. The installer refuses unrecognized project IDs and does not adopt DVCS. Google login and deployment remain untested live. Google AI Pro is separate from API access; no paid plan or API key is required for the local-first app.

## CV extraction update (1.0.1)

After updating the deployed version, click **Extract draft CV excerpts** again. The app archives untouched drafts from the older parser, while preserving approved facts and facts you edited. New rows show their CV section and employment context. A mixed summary or a shuffled education table is marked **Needs categorization**; it cannot be approved in that category. Compare against your original PDF, separate claims or repair the row, choose its category and explicitly approve it. The app cannot reconstruct table relationships after layout information is lost.

For deployment access without manual copying, see [GOOGLE_ACCESS.md](GOOGLE_ACCESS.md).

## Shared access (1.1.0)

The shared version is now implemented and tested locally. Use **Access** to invite emails and configure host allowances; users sign in with an emailed code and see only their records. All emails and replies pass through the hosting account, with per-user approval and scoped reply metadata. Use authenticated Download buttons for exports; direct Google Docs editing is available only to the host. The hosting Google account can access the stored data. Follow [SHARED_SITE.md](SHARED_SITE.md) for the required live two-account pilot; this has not been deployed or validated in Google yet.
