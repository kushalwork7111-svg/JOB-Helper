# One hosting account, separate site logins

Version 1.1.0 implements the user's selected model. One Google account owns the project, workbook, files, triggers, AI connection, Gmail access and MailApp sending. Other users configure no Google project. They sign in with a code sent to their invited email. Each user sees only their own records and approves their own outgoing messages. The hosting Google account inherently can access the stored data; this is stated on the sign-in/profile screens.

## Owner pilot

Use the existing Job Helper project; preserve its original deployment/source and data for rollback. Do not deploy over DVCS. `npm run build` produces a private default archive plus `Job-Helper-Shared-Pilot.zip`. The latter has the same Google OAuth scopes and executes as the host, with anonymous access to the **login shell**. Data endpoints still require native owner identity or a verified session. Shared access defaults off in Script Properties, so visitors cannot reach data by changing deployment access alone.

1. First apply the private 1.1.0 build to the known Job Helper project. Run its existing setup if needed. Owner data is preserved; legacy untagged Sheet records remain owner-only.
2. Open **Access**. Enable invitation sign-in and add the exact test email addresses. Granting access sends no invitation/email; share the site URL separately. The user requests their own code. Reinviting/disable invalidates old sessions.
3. Create the reviewed shared pilot deployment with the optional manifest. Keep an owner-only rollback version available. Do not share the Google account/password itself.
4. Test one owner and two fictional test accounts. Confirm each sees only its own CV, facts, jobs, applications, reminders and exports. Guessing another record ID must return not found. Ordinary users must have no Access controls or editable AI credential field. Download each user's own files through authenticated buttons; Drive files stay owner-private and are never shared publicly.
5. Test code expiration/wrong codes, sign-out and disabled-user revocation. Close/reopen the browser tab as well: sessions are stored in sessionStorage and last at most 8 hours. No raw tokens/codes are stored in Script Properties, logs or URLs.
6. Each account tests its own briefing and confirms receipt before enabling its own employer-email preference. The host separately tests/confirms the host briefing before enabling shared employer sending in Access. Do not send to employers during this pilot. Enable AI only if the host wants it, then each user separately opts into processing.
7. Check the shared trigger and Google quotas. One private scheduler runs every 15 minutes and sends due briefings around/after each user's chosen hour. It uses a rotating cursor and runtime budget, so a busy queue may send later. Disabling one user's daily email does not remove other users' automation.

The server limits the pilot to 25 accounts including the host. Login codes expire after 10 minutes, have five attempts, one request/minute, five requests/account/hour, a host-wide 30/hour and 40/day cap, and a remaining-quota reserve. Employer mail has a host-configurable 1–25/user/day cap (default 10). These limits protect the single Google quota; they do not establish capacity for a large public service.

## Replies, follow-ups and delivery

All outgoing mail uses the hosting Google account with the candidate name and verified site email in the body, and the host as Reply-To. Invited users never obtain general mailbox access. Their reply checks query a per-user HMAC reference and return metadata only when the subject has exactly that reference and From matches the confirmed recipient. Application and outreach replies are tracked separately; an outreach reply does not manufacture a submitted application. Changed subjects/senders and replies sent directly to a candidate address require manual status confirmation.

Follow-ups still require each user's approval and a no-reply confirmation. Found replies cancel/stop follow-ups. Concurrent notes/outreach and later pipeline stages are preserved during reply synchronization. No scheduled task sends employer applications, outreach or follow-ups.

Uncertain delivery is not retried automatically. The native host checks the shared Sent mailbox, waits at least 10 minutes for a possibly running send, then can use `resolveSharedDelivery(userId, applicationId, kind, draftId, confirmedSent)`. `kind` is application/followup/outreach; no candidate can invoke that host-only recovery. Recovery does not itself resend anything. Quota failures may require this recovery because delivery fails conservatively.

## Boundaries and rollback

Default `appsscript.json` remains MYSELF. Optional `appsscript.shared.json` exposes a login shell with no extra scopes. Disable shared access in Access and revert to the prior private deployment if the pilot fails. Keep the host's native Google sign-in available when disabling shared login. Existing records/files remain; no migration deletes them. Unknown/malformed records fail closed.

Local tests do not validate Google anonymous hosting behavior, OAuth, real code delivery, Drive OCR/conversion/PDF output, Gmail metadata visibility, quotas or trigger timing. Those remain account-side pilot checks. Generic employer forms and LinkedIn still use user-reviewed handoffs. No additional subscription is required; AI Pro consumer access is not API access.
