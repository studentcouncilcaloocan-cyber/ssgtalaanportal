# TALAAN v2 — GitHub Source Baseline (Step 3.17)

This is a source-control baseline, **not a working deployable application**.

- `public/` is the Firebase Hosting directory.
- `worker/` is backend source only; it must never be served from `public/`.
- `firebase.json` configures Firebase Hosting; no `.firebaserc` is included because the staging project ID is not yet confirmed.
- `public/talaan-config.js` intentionally contains blank placeholders. The website will not work until configured.
- `index.html` references `manifest.json` and `icons/icon-192.png`, neither of which was supplied in the Step 3 ZIP. These assets must be recovered or references updated before deployment.
- Do not commit service-account JSON, passwords, peppers, or real student data.
- Do not deploy this baseline to production. No authenticated integration tests have been completed.

## GitHub browser upload
Extract the ZIP. In the GitHub repository select Add file > Upload files. Drag the **contents** of this folder (`public`, `worker`, `firebase.json`, `.gitignore`, and this README), not the ZIP or enclosing folder. Commit to main as a source baseline. GitHub upload may omit hidden `.gitignore`; it can be added separately later if needed.

## Next
Identify staging Firebase project ID, Firebase web app config, and staging Cloudflare Worker URL. Then produce a fully configured staging release and run role-based tests before publishing.
