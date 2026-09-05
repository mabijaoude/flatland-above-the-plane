# Contributing

Thank you for helping improve *Flatland: Above the Plane*. Contributions should strengthen the dimensional simulation, its accessibility, its historical accuracy, or its public documentation.

## Before opening a change

- Search existing issues and pull requests for overlapping work.
- Keep the simulation's geometry and behavior separate from claims about Abbott or Victorian history.
- Cite the primary text or reliable scholarship when changing source or historical context.
- Confirm that any art, audio, font, book text, or other asset you add can be redistributed under the license you identify.
- For a large feature or a change to the project's public scope, open an issue before investing substantial work.

## Local setup

Use Node.js 22.12 or later, pnpm 11, and Git LFS. Fork the repository on GitHub, then clone your fork (replace `YOUR-USERNAME` below):

```powershell
git lfs install
git clone https://github.com/YOUR-USERNAME/flatland-above-the-plane.git
cd flatland-above-the-plane
git lfs pull
pnpm install --frozen-lockfile
pnpm dev
```

Before opening a pull request, run:

```powershell
pnpm verify
```

That command checks release notices, dependency licenses, materialized assets, and Blender metadata, runs the test suite, and creates a production build. `private: true` in `package.json` prevents accidental npm publication; it does not limit use, forks, or contributions under the MIT License.

For UI, navigation, or bundling changes, also run:

```powershell
pnpm exec playwright install chromium
pnpm test:browser
```

The browser suite uses a temporary preview of `dist/` on `127.0.0.1:4173` and fresh browser storage. `PLAYWRIGHT_BASE_URL` can target an existing development server instead. Do not use a live production site for mutation-based tests.

Development saves are local to your browser and origin. No credentials or `.env` file are required to run this project. Never put a secret in a `VITE_` variable: those values become public browser code.

## Project conventions

- Keep the authoritative simulation in two dimensions. Survey height is a visitor's view, not a source of hidden 3D simulation state.
- Keep citizen geometry independent of gender, rights, intelligence, worth, and occupation.
- Distinguish events found in the novella from examples introduced by this adaptation.
- Preserve direct, ungated access to the complete source text.
- Preserve the Project Gutenberg header, footer, and license unless the project deliberately adopts Gutenberg's alternative redistribution path and removes every Gutenberg reference.
- Add or update tests for behavior changes.
- Keep Blender sources uncompressed and clear local home-directory paths from saved File Browser workspaces. The release check scans this binary metadata; text-only secret scanners do not cover it.
- Prefer clear interface copy over specialized terminology when both are accurate.

## Pull requests

A focused pull request is easier to review. Include:

- what changed and why;
- screenshots or a short recording for visible changes;
- tests performed;
- source citations for historical or textual claims; and
- license and origin information for new assets.

Do not include secrets, private-network addresses, personal data, generated dependency folders, or unrelated formatting changes.

Dependabot updates are proposals, not required upgrades. Review release notes, keep runtime and toolchain changes focused, and update both third-party notice files when production dependency versions change. Passing CI is required but is not a substitute for checking the visible application.

## Licensing contributions

By submitting a contribution, you agree that your contribution may be distributed under the repository's MIT License, unless the contribution is clearly identified as third-party material under another compatible license. You must have the right to submit it.

Questions and respectful disagreements about interpretation are welcome. Keep them tied to the text, mathematics, implementation, or cited scholarship.
