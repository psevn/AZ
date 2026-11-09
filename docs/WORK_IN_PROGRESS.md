# Work in Progress — Calm Product UI

## Step 1: Self-hosted fonts

**Branch:** `feature/calm-ui-step1-fonts`  
**Base:** `design/calm-ui-step1`  
**Status:** In progress; awaiting local dependency installation and verification.

### Done
- Added Inter Variable CSS import to `src/main.tsx`.
- Added IBM Plex Sans Arabic weights 400, 500, and 600 to `src/main.tsx`.
- Kept the approved `public/az-mark.svg` unchanged.
- Kept this work isolated on a child branch of `design/calm-ui-step1`.

### Not yet done / not verified
- `npm install @fontsource-variable/inter @fontsource/ibm-plex-sans-arabic` has not yet been run on the project environment.
- `package.json` and `package-lock.json` have not yet been updated by npm.
- `npm run build` has not been run for this branch; build status is unknown.
- No browser screenshots or font-rendering checks have been produced.
- The PNG mockup renders are present on `design/calm-product-ui`; the HTML mockup source was reviewed, but the PNG image render itself could not be inspected in this run.

### Collaboration note
The requested `docs/COLLABORATION.md` was not found at the repository root or under `docs/` on the checked branch. Until its location is clarified, this change follows the stated constraints: isolated branch, one focused file area, and a separate PR for the step. No merge to `main`, deployment, or database changes were made.
