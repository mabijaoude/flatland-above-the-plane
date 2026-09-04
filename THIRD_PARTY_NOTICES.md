# Third-party notices

The deployed application includes open-source JavaScript packages, fonts, and a public-domain ebook edition. These materials are not relicensed under the project's MIT License.

The release artifact includes the detailed, versioned inventory at [`public/THIRD_PARTY_NOTICES.txt`](public/THIRD_PARTY_NOTICES.txt) and canonical copies of the license families used by the resolved production packages:

- [MIT](public/licenses/MIT.txt)
- [ISC](public/licenses/ISC.txt)
- [BSD 3-Clause](public/licenses/BSD-3-Clause.txt)
- [Apache License 2.0](public/licenses/Apache-2.0.txt)
- [SIL Open Font License 1.1](public/licenses/OFL-1.1.txt)

The exact dependency graph and versions are recorded in `pnpm-lock.yaml`. Run `pnpm licenses list --prod` to reproduce the package-level inventory and `pnpm check:licenses` to enforce the repository's current license allowlist.

## Project Gutenberg ebook 97

`public/books/flatland/` contains the complete illustrated Project Gutenberg HTML edition of Edwin A. Abbott's *Flatland*. Project Gutenberg identifies ebook 97 as public domain in the USA. The edition's Project Gutenberg header, footer, and full license are retained in the HTML, and `source.json` records its origin.

The Project Gutenberg name is a trademark and does not imply endorsement of this application. If you redistribute the Gutenberg-branded edition, follow the terms retained with the ebook and check copyright law in the place where you are distributing it.

## Fonts

- Besley: Copyright 2020 The Besley Project Authors; SIL Open Font License 1.1.
- Source Sans 3: distributed by Fontsource under the SIL Open Font License 1.1.

## Key runtime libraries

- React and React DOM — MIT; Copyright Meta Platforms, Inc. and affiliates.
- three.js — MIT; Copyright 2010–2025 three.js authors.
- React Three Fiber and Drei — MIT.
- Lucide — ISC, with Feather and Lucide contributor notices retained in the detailed inventory.

This summary is provided for convenience. The package-specific license and notice files in each dependency's source distribution remain authoritative.
