# September 2026 release review

Scope: review the complete application and open-source readiness, implement small improvements, and deploy only to development. Production and repository visibility are unchanged. This is a practical release review, not a penetration-test or accessibility certification.

## Findings and changes

| Area | Finding | Resolution |
| --- | --- | --- |
| Production startup | Package-specific vendor splitting could create a React/reconciler initialization cycle despite a successful build and unit suite. | Keep the dependency graph in one vendor chunk; exercise the actual built app in CI. |
| Binary assets | An ordinary checkout could leave Git LFS pointers where images were expected. | CI fetches LFS; the build rejects unresolved pointers and invalid PNG signatures; browser checks decode every book illustration. |
| Source privacy | Three Blender workspaces retained an embedded local file-browser path. | Sanitize current sources, verify they still open in Blender, and add regression guards. **Historical copies still need the separately approved cleanup in the publishing checklist.** |
| Reading | Font changes could move the current passage thousands of pixels away; size reset on reopening. | Preserve a text-block anchor and remember text size locally. |
| Compact reading | Text-size controls disappeared below 430 CSS pixels; chapter navigation ignored reduced motion. | Keep controls visible on phone widths and respect reduced motion inside the book frame. |
| Keyboard continuity | Clearing a failed search or moving between context and book could lose useful focus; welcome Tab navigation escaped its dialog. | Restore appropriate focus and contain onboarding Tab navigation. |
| Discoverability | Geometry choices displayed only side counts; the help recipe opened the wall during the extra-direction example. | Add polygon previews and explain carrying across a still-closed boundary. |
| Failure recovery | A failed application download could leave the loading screen with no useful next action. | Provide a reload action and direct access to the HTML book, without displaying exception details. |
| Hosting | Older nginx runtime and long-lived caching of stable artwork URLs made maintenance less reliable. | Update to nginx 1.30.4, revalidate stable URLs, cache hashed bundles immutably, hide version details, and add defensive response headers. |
| Contribution workflow | A new contributor could miss LFS, licenses, browser checks, or the local-data model. | Expand README/CONTRIBUTING, add smoke tests, and make launch gates explicit. |

The hosting Content Security Policy is intentionally limited to object, base-URL, and framing restrictions. It is not a complete script/worker allowlist. npm audit reported no known vulnerabilities; that is not a full container or source-code security audit.

## Timed interaction evidence

Times below are UTC (the work began on September 4 in the reviewer's local timezone). Each session uses an isolated browser profile, not the owner's browser-local saved town.

| Session | Time and duration | Interaction coverage | Outcome |
| --- | --- | --- | --- |
| 1 — first-time desktop visitor | September 5, 00:37:01–00:42:07; 306 seconds | All six guided-tour stages, Native vision, undo, complete book/images, chapters 17/19, text sizing, source/context links, citizen search/follow, controls, pause/resume, reset cancellation, save/reload. | No application errors or failed requests; found reading-position and focus issues corrected above. |
| 2 — direct manipulation and compact layout | September 5, 00:42:07–00:47:09; 302 seconds | Carry/height/placement, named destinations, direct control, safe return, citizen creation and empty-name validation, wall removal/undo, compact viewport, reduced motion, chapter navigation, Lite quality. | No application errors or failed requests; found hidden phone reading controls and motion mismatch; identified larger non-canvas accessibility and mobile-layout ideas. |
| 3 — updated-development touch visit | Pending final development deployment | Phone portrait/landscape, reading controls and saved passage, geometry previews, tour/carry controls, navigation and recovery. | To be recorded after the deployed session. |

## Automated and repository evidence

- Release/license checks validate 67 production dependency entries, five bundled dependency license texts, and the retained source edition.
- All 106 tests across 20 unit/component files pass, covering simulation, geometry, topology, controls, persistence, reader anchors, asset validation, and Blender metadata privacy.
- Eight production-build browser tests cover startup/tour, full-book decoding, reading position/size, focus, search, download-failure recovery, required assets/notices, and touch-sized reduced-motion reading.
- `pnpm audit --audit-level=low` returned no known vulnerabilities at review time.
- All three sanitized Blender sources opened in Blender 4.5.10 with relative workspace paths and intact material/image data.
- The private repository already has the demo homepage, description, topics, Issues, dependency maintenance, and core community documents. No open Dependabot security alerts were returned. Optional dependency PRs were not merged as part of this pass.

## Remaining boundaries

Do not make the repository public until its historical binary metadata and owner rights checks are resolved. Production promotion is a separate explicit decision. No DNS, certificates, production container, repository visibility, analytics, or account integration is changed by this review.

Physical-device browser testing, screen-reader parity, WebGL context-loss recovery, deeper rendering/performance profiling, and a complete container vulnerability scan are not claimed here. The prioritized product backlog is [Astra improvements](../Astra%20improvements.md); actionable owner gates are in [the publishing checklist](PUBLISHING_CHECKLIST.md).

Technical references: [official nginx releases](https://nginx.org/en/download.html), [GitHub checkout LFS option](https://github.com/actions/checkout), and [Playwright test configuration](https://playwright.dev/docs/test-configuration).
