# Screenshots

These are actual application captures, not rendered concepts or AI-generated product images. They were captured for the September 2026 release preparation, using fresh disposable Chromium contexts, a default town, normal UI controls, and the existing development deployment. No personal browser profile or saved town was used. Images contain only the application viewport, not browser chrome or local/deployment addresses.

| File | What it shows |
| --- | --- |
| `town-overview.jpg` | The town framed from above, paused for the capture |
| `dimensional-lift.jpg` | Soren Abbott lifted out of the plane, with placement controls |
| `native-vision.jpg` | The guided visit's restricted in-plane view |
| `illustrated-book.jpg` | The complete book reader at section 17 |
| `source-and-context.jpg` | The optional explanation of the dimensional argument |
| `../../public/social-preview.jpg` | A 1200 × 630 overview for website link previews and the repository's social-preview setting |

The interface and original artwork are covered by the project license. Screenshots that include the book reproduce material from the bundled Project Gutenberg edition; that edition is not relicensed under MIT. See the [rights map](../RIGHTS.md) and the retained notices in the reader.

## Refreshing the captures

With dependencies and Playwright Chromium installed, set `SCREENSHOT_BASE_URL` to an already running development application, then run:

```powershell
node scripts/capture-readme.mjs
```

The script does not start a web server. It creates isolated browser contexts, drives the real UI, writes JPEGs directly (without retouching), and closes its browser in a `finally` block. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` optionally selects an installed Chromium browser. Review every image before committing, especially after changing the interface or the book edition. JPEGs are stored in ordinary Git so README rendering does not depend on Git LFS image delivery.
