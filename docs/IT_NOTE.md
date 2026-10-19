# Client-Ready PowerPoint add-in: note for IT

**Request:** please deploy this Office add-in to [user / group] through the Microsoft 365 admin centre:
**Settings → Integrated apps → Upload custom apps**, then upload `manifest.xml` from this repository.

## What it is
- A standard **Office Add-in** (task pane), built only with Microsoft's Office.js API.
- It formats the open presentation: title position, fonts, text sizes and a brand-guideline check.

## Security summary
| Question | Answer |
|---|---|
| Executable or installer? | No. It is a web page loaded inside PowerPoint's add-in sandbox. |
| Macros / VBA / COM? | None. |
| Admin rights needed? | No. |
| Permission requested | `ReadWriteDocument`: the open presentation only. |
| Network calls | Only (1) its own static files from the hosting address in `manifest.xml`, and (2) Microsoft's Office.js from `appsforoffice.microsoft.com`. |
| Data leaving the document | None. No server, no database, no analytics or tracking, no AI services, no API keys. |
| Confidential content in the code | None. Brand rules are generic numbers (fonts, sizes, colours). No client data. |
| Source code | Fully available in this repository for review (`taskpane.html`, `taskpane.js`, `src/rules.js`, `brand.json`). |
| Updates | New versions are published to the same address and load the next time the pane opens. The manifest only changes if the name, icons or permissions change. |

## Hosting
Static HTTPS hosting on GitHub Pages: `https://kushalwork7111-svg.github.io/JOB-Helper/`.
If IT prefers an internal host, copy the files there and change the URLs in `manifest.xml`.

Contact: Kushal, BDO India DVCS.
