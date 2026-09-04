# Flatland UX and visual polish roadmap

This roadmap follows a live desktop and phone-sized walkthrough of the NAS build. The quick pass focuses on clarity and access without changing the simulation model. The larger items are intentionally separated because each needs design prototypes and user testing rather than another layer of controls.

## Implemented in the quick pass

- Reduced opening-screen chrome by withholding the Gazette and utility tray until the survey begins.
- Kept the book context visible after entry as a smaller, quieter imprint rather than a second title card.
- Removed repeated desktop utility actions from the footer; their icon equivalents remain in the masthead.
- Restored Help and Save inside the mobile utility menu even when a citizen or action panel is open.
- Increased the most-used mobile menu, action-tab, intervention, and character-form targets to at least 44px.
- Replaced phone-facing keyboard instructions with drag, pinch, movement-pad, and flight-control language.
- Added live intent and role context to the citizen picker so a name is not chosen in isolation.
- Made mobile utility actions dismiss their menu when they transition to another view or layer.

## Recommended larger changes

### 1. A single spatial interaction grammar

**Problem:** Survey, follow, direct, carry, and native vision still have different camera rules that must be learned separately.

**Work:** Prototype a shared camera director with three consistent gestures: move focus, change distance, and return to context. Add a persistent but quiet view indicator and one reversible “back to survey” action in every embodied view.

**Success measure:** A first-time user can enter and leave every view without opening the Controls guide.

### 2. Town legibility without conventional 3D props

**Problem:** Buildings have functions, but districts, routes, entrances, and interior/exterior relationships are not always legible at survey distance.

**Work:** Establish a two-dimensional cartographic language: district washes, street and square names, doorway ticks, interior hatching, activity glyphs, and restrained hover/focus labels. Preserve the book’s dimensional premise by keeping all furniture and infrastructure planar.

**Success measure:** Users can identify home, work, food, civic, educational, and restricted spaces before selecting a citizen.

### 3. Make intention visible in the society

**Problem:** The simulation has purposeful routines, but most of that purpose is visible only after selecting one citizen.

**Work:** Add optional intent traces, destination pulses, venue occupancy cues, and short social-event vignettes. The Gazette should link an event to the involved citizens and camera location instead of acting only as a log.

**Success measure:** Observers can explain what several citizens are doing and why after one minute of watching.

### 4. Purpose-built mobile composition

**Problem:** The responsive layout now fits, but it is still a compressed desktop interface with competing bottom panels and movement controls.

**Work:** Design a stateful bottom sheet with collapsed, half, and expanded stops; reserve a stable thumb zone for movement; add landscape handling; and ensure notices never occupy the same decision area as the active sheet.

**Success measure:** No active state covers both the citizen and the movement destination, at 360×740 through modern large-phone sizes.

### 5. A cohesive material and lighting system

**Problem:** Individual textures exist, but the town still needs a stronger visual hierarchy and a more authored sense of time.

**Work:** Define line weights, paper/ink roughness, district palettes, doorway contrast, citizen silhouettes, and morning-to-evening lighting as one art-direction system. Use Blender only to bake subtle planar texture and normal-map sources, never to introduce volumetric street furniture.

**Success measure:** Screenshots are recognizably Flatland at a glance, while citizens and traversable openings remain readable at every camera distance.

### 6. Interaction regression coverage

**Problem:** The most important failures have been state transitions—selection, control, carry, drop, boundary editing, and mobile navigation—rather than isolated rendering functions.

**Work:** Add browser journeys for Explore → Act → Control → Carry → Drop, native-vision exit, boundary open/seal/undo, character creation, and 390px menu access. Pair them with a small set of visual snapshots at desktop and phone breakpoints.

**Success measure:** These journeys become release gates for every NAS deployment.

## Suggested order

1. Spatial interaction grammar
2. Town legibility system
3. Mobile bottom-sheet composition
4. Visible intention and Gazette linking
5. Material and lighting art direction
6. Automated interaction and visual regression gates throughout
