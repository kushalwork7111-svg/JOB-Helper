# Let Codex update the Google project without copying code

The cloud development environment is working again. Repository access is available. Google deployment authorization is separate; no Google outbound account is connected to this cloud task, and the current tools do not offer Apps Script account connection or authenticated browser control. Giving permission in chat does not create that connection. Gmail or Google Drive access alone is not Apps Script project/deployment access.

The simplest supported route is a **local Codex task on your computer**, using Google clasp authorization stored locally. This avoids sending login credentials into chat or cloud settings.

1. In Codex, use its project/folder picker to open the extracted Job Helper installer folder on your computer as a local project. Do not choose a cloud environment for this task. Exact button labels vary by app version.
2. If you ran the installer successfully, leave its `.job-helper-auth.json`, `.job-helper-created.json`, and `private-project/.clasp.json` files in that folder. They let the local agent use the existing Google authorization and identify only the Job Helper project. Do not upload or share these files.
3. Tell the local task to update Job Helper from this repository's reviewed release, preserve the existing Job Helper project/deployment URL and data, and leave DVCS untouched. The agent should verify the marker's project ID, back up the existing source, compare scopes/manifest, push only app files, create a version, and update only the confirmed Job Helper web deployment.
4. If Google login is missing or expired, the local agent can start `npm exec --yes --package=@google/clasp@3.4.1 -- clasp --auth .job-helper-auth.json login` from that folder. You sign in on Google's own page. Enable Apps Script API at https://script.google.com/home/usersettings if requested. Do not paste authorization codes, passwords, cookies or tokens into chat.

If you did not use the installer, the local agent needs the **Script ID** shown in Job Helper's Apps Script Project Settings to select the right project. A Script ID is an identifier, not a password. Do not confuse it with the `/exec` deployment ID or a DVCS project ID.

The default release remains Only myself / executes as owner. Version 1.1.0 implements the shared site locally: one Google host/sender, separate application logins, users see only their own records, and the logged-in user approves their own messages. The optional shared manifest is a pilot, not a live-validated public deployment. Follow docs/SHARED_SITE.md and test two accounts before opening access. No new Google scopes are added.

Google login/deployment and real Drive OCR still need account-side testing. The private CV was tested locally; no employer messages or AI calls were sent for parser QA.
