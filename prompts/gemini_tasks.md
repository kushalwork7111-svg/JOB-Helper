# Gemini task texts

Replace <SHEET LINK> with the sheet address after `setup()` runs.

**Daily search** (schedule: daily 07:30 Asia/Kolkata):
`SCHEDULE: once a day 07:30 IST. UNATTENDED: never stop to ask. Run /job-finder-v1 DAILY SEARCH on the sheet "Job Finder Data" (<SHEET LINK>). If you cannot edit it, reply "NOT SAVED: …" first.`

**Tailor on request** (trigger: an email *sent from my mailbox* with subject exactly `Job Finder: tailoring requested`, any folder, do not limit to Inbox):
`TRIGGER: the email "Job Finder: tailoring requested" sent from my own mailbox. UNATTENDED. Run /job-finder-v1 TAILORING for every QUEUED row in Tailor Requests of "Job Finder Data" (<SHEET LINK>). Do not run the daily search.`

**Back-up check** (schedule: 11:00, 15:00, 19:00 IST):
`SCHEDULE: 11:00, 15:00, 19:00 IST. UNATTENDED. If Tailor Requests in "Job Finder Data" (<SHEET LINK>) has QUEUED rows, run /job-finder-v1 TAILORING. Otherwise reply "Nothing waiting." and change nothing.`
