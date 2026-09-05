# Astra improvements

Prioritized follow-up ideas from the September 2026 release review. These are iteration ideas, not conditions for adding every feature before the first release. Preserve the engraved-map style, ungated book access, and the distinction between playable geometry and historical commentary.

## 1. A guided locked-room experiment

The current tour teaches the controls successfully but finishes with wall editing. The central mathematical insight deserves a separate short experiment: locate the sealed Closed Room, carry a citizen across its unchanged boundary, then contrast that route with movement within the plane.

- Offer it as an optional next step after the existing tour.
- Keep the wall visibly sealed throughout; explain why a fourth spatial direction is an analogy rather than simulated physics.
- Provide named inside/outside destinations and an undo/reset path.
- Success: a first-time visitor can explain the extra-direction idea after two minutes, without first reading the context page.

## 2. An accessible, non-canvas action surface

Keyboard shortcuts cover many actions, but selecting an arbitrary wall still depends on pointing at the map. A full screen-reader-equivalent experience needs more than labelled buttons.

- Add a searchable building/boundary list with open/closed state and labelled edit actions.
- Offer textual descriptions of the selected citizen's surroundings and currently available routes.
- Test with NVDA and VoiceOver, high zoom, and users who cannot use a pointer.
- Success: complete the locked-room interaction without mouse or touch input, with useful confirmation of each state change.

## 3. Mobile carry and landscape refinement

The compact follow controls are a strong starting point. Carrying, precise placement, and expanded action sheets can still compete for limited screen area, especially in landscape.

- Keep one obvious primary action and a clearly visible return/cancel path.
- Consider a small ground-target indicator that distinguishes height, destination, and wall collision.
- Test physical iOS Safari and Android Chrome, including the virtual keyboard and browser chrome expanding/collapsing.
- Success: place a citizen safely in portrait and landscape without panels obscuring the target or requiring unexplained gestures.

## 4. Explain Native vision on demand

The first entry can be visually surprising. A dismissible explanation could distinguish boundary brightness, apparent width, and occlusion without giving the citizen an overhead map.

- Use the existing visual vocabulary and concise text; make the explanation optional and replayable.
- State the approximation's limits precisely.
- Success: users understand why the view differs from ordinary 3D first-person vision and can return above immediately.

## 5. Performance and graceful degradation

- Measure rendering on a mid-range phone, integrated graphics, and a throttled network before changing visual fidelity.
- Keep automatic quality decisions stable and offer a clear recovery path for WebGL initialization/context loss.
- Profile the renderer before reintroducing fine-grained vendor chunks; browser startup tests must remain mandatory.
- Hidden 3D drawing now pauses during reading/context and Native vision; further reductions in background simulation work should explicitly explain any change to town time.
- Success: documented frame-time and loading budgets, with no loss of book/context access on rendering failure.

## 6. Portable towns and shareable experiments

An optional versioned export/import would make browser-local saves less fragile and let people share experiments without accounts or a server-side database.

- Validate imported data, cap file size, reject invalid topology, and explain that citizen names may be personal data.
- Keep importing reversible and avoid silently overwriting a current town.
- Consider curated, reproducible scenario links before arbitrary user-state URLs.

## 7. Sustainable open-source maintenance

- Publish small, dated releases with concise changelogs and a few focused screenshots.
- Label starter issues and state which historical, accessibility, or simulation contributions are most useful.
- Keep optional dependency migrations separate from fixes and review license notices with each production update.
- Add stricter script/worker Content Security Policy only after auditing the renderer's worker and generated-code requirements.
- Revisit dependency/container scanning, update cadence, and browser coverage periodically.

## Small improvements completed in this pass

- Reader text-size controls remain available on phone widths; the size is remembered.
- Font changes and reopening preserve a text-block reading anchor.
- Reader chapter navigation respects reduced-motion preferences.
- Search reset and book/context return paths keep useful keyboard focus; onboarding contains Tab focus.
- Geometry choices have small polygon previews; the help recipe demonstrates crossing a still-closed boundary.
- Build/CI checks fetch and validate Git LFS assets and inspect Blender source metadata.
- Static asset caching distinguishes hashed bundles from stable artwork URLs.
- Browser smoke coverage exercises startup, the tour, reader, search, and compact layout.
- Hidden 3D drawing pauses during reading/context and Native vision; Native vision reuses its canvas buffer between simulation updates.

Launch prerequisites and review evidence belong in [the publishing checklist](docs/PUBLISHING_CHECKLIST.md), not this feature backlog.
