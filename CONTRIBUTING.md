# Contributing

Thank you for helping improve *Flatland: Above the Plane*. Contributions should strengthen the dimensional simulation, its accessibility, its historical accuracy, or its public documentation.

## Before opening a change

- Search existing issues and pull requests for overlapping work.
- Keep the simulation's geometry and behavior separate from claims about Abbott or Victorian history.
- Cite the primary text or reliable scholarship when changing source or historical context.
- Confirm that any art, audio, font, book text, or other asset you add can be redistributed under the license you identify.
- For a large feature or a change to the project's public scope, open an issue before investing substantial work.

## Local setup

Use Node.js 22 or later and pnpm 11:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Before opening a pull request, run:

```powershell
pnpm verify
```

That command checks release notices and dependency licenses, runs the test suite, and creates a production build.

## Project conventions

- Keep the authoritative simulation in two dimensions. Survey height is a visitor's view, not a source of hidden 3D simulation state.
- Keep citizen geometry independent of gender, rights, intelligence, worth, and occupation.
- Distinguish events found in the novella from examples introduced by this adaptation.
- Preserve direct, ungated access to the complete source text.
- Preserve the Project Gutenberg header, footer, and license unless the project deliberately adopts Gutenberg's alternative redistribution path and removes every Gutenberg reference.
- Add or update tests for behavior changes.
- Prefer clear interface copy over specialized terminology when both are accurate.

## Pull requests

A focused pull request is easier to review. Include:

- what changed and why;
- screenshots or a short recording for visible changes;
- tests performed;
- source citations for historical or textual claims; and
- license and origin information for new assets.

Do not include secrets, private-network addresses, personal data, generated dependency folders, or unrelated formatting changes.

## Licensing contributions

By submitting a contribution, you agree that your contribution may be distributed under the repository's MIT License, unless the contribution is clearly identified as third-party material under another compatible license. You must have the right to submit it.

Questions and respectful disagreements about interpretation are welcome. Keep them tied to the text, mathematics, implementation, or cited scholarship.
