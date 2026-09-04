# Flatland: Above the Plane

An independent browser simulation inspired by the dimensional thought experiment in Edwin A. Abbott's 1884 novella *Flatland: A Romance of Many Dimensions*.

**Live demo:** [flatland.codefactory.synology.me](https://flatland.codefactory.synology.me/)

The world is authoritative in two dimensions: citizens, streets, buildings, walls, doors, routes, and interventions all exist on one plane. A three-dimensional survey view lets the visitor see that plane from outside it and test what an extra spatial direction would make possible.

## The thought experiment

In *Flatland*, the Sphere demonstrates that a being with access to a third direction can see inside closed two-dimensional spaces, retrieve an object from a locked cupboard, and lift the Square out of his plane. The Square then argues by analogy for a fourth spatial dimension.

This project turns that progression into an interactive scenario:

1. A Flatlander is enclosed by a two-dimensional boundary.
2. A three-dimensional visitor lifts the Flatlander off the plane, moves across the boundary, and returns them without crossing the wall.
3. By the same Euclidean analogy, a hypothetical four-dimensional visitor could move an object into or out of a sealed three-dimensional box without crossing its surface.

The Closed Room rescue and the sealed-box example are adaptations of the book's dimensional reasoning, not scenes reproduced word-for-word. The analogy assumes an additional Euclidean spatial coordinate; it is a mathematical visualization, not a claim about the physics of our universe.

## Source and context

*Flatland* combines mathematical fiction with a satire of Victorian society. Part I's narrator describes a social order in which sex determines geometry, rank follows the number of sides, and the state enforces the hierarchy through coercion and violence. This simulation does not use those rules: shape and side count do not determine a citizen's intelligence, rights, worth, gender, or occupation.

Abbott's revised preface directly addresses the contemporary “woman-hater” objection, says the narrator had identified himself “perhaps too closely” with Flatland's views, and says he wished to disavow aristocratic tendencies attributed to him. Modern scholarship commonly reads the work as satire. The project does not require readers to accept a single comprehensive claim about Abbott's intentions; it states the narrower source record and the choices made in this adaptation.

See [Source and adaptation notes](docs/SOURCE_AND_CONTEXT.md) for the chapter references, short quotations from the revised preface, scholarly sources, and a precise source-versus-project map. The complete historical text remains directly available in the application without a context gate.

## Experience

- **Town view** follows autonomous citizens, surveys the town from above, and frames the plane as an engraved 1884 map.
- **Find citizen** searches live intent and destination data, then locates, follows, or picks up a resident directly.
- **Native vision** approximates what a resident confined to the plane could see: boundary brightness and neighboring cross-sections, with walls providing occlusion.
- **Edit walls** makes every boundary state-aware: hover or tap an edge, remove an existing wall in red, or add a wall across an opening in green. Every change triggers route replanning.
- **Dimensional manipulation** lifts any selected citizen without a preliminary control step; placing them resumes their routine automatically.
- **Read the book** opens the complete illustrated Project Gutenberg edition, with its source notice and license retained.

The town contains homes, workplaces, civic buildings, public spaces, and deterministic resident schedules. Versioned browser-local saves retain topology, routines, player-created citizens, and camera state. No account or server-side save is required.

Desktop shortcuts are surfaced contextually in the application: `E` picks up the selected citizen, `F` follows, `T` opens wall editing, `Ctrl`/`⌘` + `Z` undoes a plane change, and `Space` places and releases a carried citizen. In wall editing, hovering an edge reveals its only valid action—red Remove wall or green Add wall. On phones and tablets, tapping an edge reveals that same contextual action while the bottom bar becomes Undo, Reset, and Done. Following a citizen replaces the navigation with a persistent bar for their actions, native view, and a one-tap Stop.

## Technology

- React 19, TypeScript, Vite, Three.js, React Three Fiber, and Drei
- Deterministic 30 Hz simulation in a Web Worker
- Local A* navigation, region topology, spatial-hash avoidance, and explicit AI/player control
- Blender-authored planar materials baked to compact color and normal textures
- Vitest unit and component tests

## Run locally

Requirements:

- Node.js 22 or later
- pnpm 11 (the repository pins the package-manager version)

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Vite serves the application on `http://127.0.0.1:5173` by default.

Run the verification suite:

```powershell
pnpm test
pnpm build
```

Rebuild the optional planar material library with Blender 4.5 or later:

```powershell
blender --background --python scripts/blender/build_flatworld.py
```

## Repository layout

- `src/simulation/` — deterministic society, topology, geometry, navigation, and worker
- `src/components/` — planar renderer, reader, camera views, dialogs, and controls
- `public/books/flatland/` — complete Project Gutenberg HTML edition and source record
- `public/assets/materials/` — optimized runtime color and normal textures
- `art_source/` — editable Blender material source and historical prototypes
- `scripts/blender/` — reproducible Blender material build
- `docs/` — source context, rights map, and publication checklist
- `flatworld_simulation_technical_spec_v0_2.md` — original product and simulation brief

## Contributing and security

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), and use [SECURITY.md](SECURITY.md) for private vulnerability reports. Changes that characterize the book or its history should cite a primary source or reliable scholarship.

## Rights and licenses

Original project code, documentation, and assets are licensed under the [MIT License](LICENSE), unless a file says otherwise. The bundled book is not relicensed under MIT: Project Gutenberg identifies ebook 97 as public domain in the USA, and its retained Project Gutenberg notice and license govern use of that distributed edition. Copyright status can differ outside the United States.

See [Rights map](docs/RIGHTS.md) and [Third-party notices](THIRD_PARTY_NOTICES.md) before redistributing the complete repository or a built release.
