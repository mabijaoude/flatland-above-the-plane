# Rights map

This map explains which license applies to each part of the repository. It is a practical inventory, not legal advice.

| Material | Location | Rights and license |
| --- | --- | --- |
| Original application source | `src/`, project configuration, Docker files, and original scripts | MIT License; see `LICENSE` |
| Original project documentation | `README.md`, `docs/`, project roadmaps, and technical specifications | MIT License, unless a file says otherwise |
| Original project artwork and materials | `art_source/` and `public/assets/`, excluding third-party material identified below | MIT License, to the extent created and owned by project contributors |
| *Flatland* ebook | `public/books/flatland/` | Excluded from the project's MIT grant. Project Gutenberg identifies ebook 97 as public domain in the USA. The retained Gutenberg notice and license apply to this distributed edition. Copyright status can differ by country. |
| Besley font files | Installed through `@fontsource/besley` and included in production builds | SIL Open Font License 1.1 |
| Source Sans 3 font files | Installed through `@fontsource/source-sans-3` and included in production builds | SIL Open Font License 1.1 |
| JavaScript dependencies and icons | Declared in `package.json` and resolved in `pnpm-lock.yaml` | Their respective MIT, ISC, Apache-2.0, BSD-3-Clause, or other declared licenses; see `THIRD_PARTY_NOTICES.md` |

## Redistribution notes

When distributing the complete application:

1. include the project's `LICENSE` for original work;
2. include `THIRD_PARTY_NOTICES.md` or the build's `THIRD_PARTY_NOTICES.txt`;
3. retain the complete Project Gutenberg header, footer, and license in `public/books/flatland/index.html`;
4. do not describe Project Gutenberg as endorsing this project; and
5. check the copyright status of *Flatland* in the countries where a copy will be distributed.

The release check verifies the repository's required notices and the retained Gutenberg markers. It cannot determine copyright status in every jurisdiction or establish ownership of newly contributed assets.
