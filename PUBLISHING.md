# Reload Tracker catalogue publisher

The tracker now loads its catalogue from `items.json`. The Manage items panel can stage edits and download a replacement catalogue immediately. To publish directly from the page to GitHub, deploy the small Cloudflare Worker in `worker.js`.

## One-time setup

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Create a Worker named something like `reload-tracker-publisher`.
3. Paste the contents of `worker.js` into the Worker editor and deploy it.
4. In the Worker settings, add these runtime variables/secrets:
   - **Secret** `GITHUB_TOKEN`: a GitHub fine-grained personal access token limited to the `N0vaspikz/reload-tracker` repository with **Contents: Read and write** permission.
   - **Secret** `ADMIN_PASSWORD`: a long, unique password used only for publishing catalogue edits.
   - **Variable** `GITHUB_REPO`: `N0vaspikz/reload-tracker`
   - **Variable** `GITHUB_BRANCH`: `main`
5. Redeploy after saving the settings.
6. Open https://n0vaspikz.github.io/reload-tracker/, choose **Manage items**, and paste the Worker URL into **Cloudflare Worker publisher URL**. The page remembers this URL in that browser.
7. Make a tiny test edit or add a test entry and press **Publish to GitHub**. Enter the admin password when prompted. Check the GitHub commit and then remove the test entry if desired.

## Safety notes

- Never put the GitHub token in `index.html`, `items.json`, or any public repository file. It belongs only in Cloudflare's secret settings.
- The admin password is sent to the Worker over HTTPS for each publish and is not stored by the page.
- The Worker only accepts requests from the GitHub Pages origin above and validates catalogue structure before writing.
- Use a unique admin password and rotate it if you think it has been exposed.
- This publisher only edits `items.json`; it does not upload image files. Add images to the repository's `icons/` folder separately, and enter only the filename in the manager.
- If you don't want to deploy a Worker yet, **Download items.json** provides a manual fallback: replace the repository's `items.json` with the downloaded file and commit it.

## Catalogue format

Each item has a stable `id`, a `name`, a `category` (`mythic`, `exotic`, or `dev`), and an image filename relative to `icons/`. Avoid changing existing IDs: saved collection progress is keyed by ID.
