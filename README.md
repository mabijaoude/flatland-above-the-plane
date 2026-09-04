# Flatland: Above the Plane

An interactive browser world about dimensions, perception, boundaries, and the social satire inside Edwin A. Abbott's 1884 novella *Flatland: A Romance of Many Dimensions*.

**Live demo:** [flatland.codefactory.synology.me](https://flatland.codefactory.synology.me/)

The simulation keeps its world authoritative in two dimensions: citizens, streets, buildings, walls, doors, routes, and interventions all exist on one plane. The visitor can survey that plane from three-dimensional space and test what one additional direction makes possible.

This project takes both sides of *Flatland* seriously. The book is a mathematical thought experiment about dimensions, but it is also a satire narrated from within a rigid society organized by sex, geometric form, and inherited class. The application makes the dimensional argument playable while keeping the book's social system in its historical and critical context rather than reproducing it as the rules of the simulated town.

## The mathematical roots

### Dimensions as independent directions

The core idea begins with a simple progression in Euclidean geometry:

- a point has no spatial extent;
- a line adds one independent direction;
- a plane adds a second direction perpendicular to the first;
- ordinary space adds a third direction perpendicular to both directions in the plane; and
- a hypothetical four-dimensional space adds another independent coordinate, conventionally called `w`.

A resident of a plane may move along `x` and `y`, but not along `z`. A three-dimensional observer has no new route *within* the plane; they have a route *out of* it. That extra degree of freedom changes which regions are reachable without crossing a lower-dimensional boundary.

### The locked-room argument

Treat Flatland as the plane `z = 0`. A closed curve in that plane separates an inside from an outside. A resident who must remain at `z = 0` cannot move between those regions without crossing the curve. A three-dimensional visitor can instead:

1. lift the resident away from the plane by changing `z`;
2. move across the boundary while outside the plane; and
3. return the resident to `z = 0` on the other side.

The wall has not been opened or crossed. It was bypassed through a direction unavailable to the resident.

Abbott develops this reasoning through the Sphere's demonstrations to the Square. In section 17, the Sphere enters a locked cupboard from outside the plane, removes a tablet, and lifts the Square into Spaceland. In section 19, the Square extends the pattern and asks whether a being with access to a fourth spatial direction could enter a sealed three-dimensional room without passing through its doors, windows, or walls.

The corresponding idealized model places ordinary space at `w = 0`. A four-dimensional path could leave that space, move around a closed three-dimensional surface, and return on its other side. This conclusion depends on the barrier being confined to the lower-dimensional space. It is a geometric analogy—not evidence that a traversable fourth spatial dimension or higher-dimensional visitors exist in nature.

The application's Closed Room rescue is an interactive synthesis of Abbott's cupboard demonstration and the Square's lift. It is not a scene reproduced word-for-word from the novella. The 2D-to-3D case is playable; the 3D-to-4D case is explained but not simulated.

### Perception from inside and outside the plane

Dimensionality affects observation as well as movement. The survey camera sees the complete planar layout from outside it, including relationships that no resident can view all at once. **Native vision** instead approximates the restricted experience of a citizen in the plane through boundary brightness, neighboring cross-sections, and wall occlusion.

The elevated camera never turns Flatland into an ordinary 3D world. Simulation geometry, collision, pathfinding, doors, wall edits, and citizen state remain two-dimensional; height belongs to the visitor's viewpoint and dimensional interventions.

## The book and its society

Published in Victorian Britain in 1884, *Flatland* uses an impossible geometric world to examine the limits of perception and the habits of a hierarchical society. Its narrator, A Square, initially treats the institutions and prejudices around him as natural facts. That limited viewpoint is part of the book's effect.

The society described in Part I is hereditary and coercive:

- women are represented as straight lines and subjected to rules justified by their assigned geometry;
- male class is encoded by polygonal form and number of sides, with triangles among the lower orders, squares and pentagons in professional ranks, many-sided polygons in the nobility, and near-circles in the priestly class;
- irregularity is treated as a defect and a threat to social order;
- rank, education, occupation, and political authority are tied to inherited shape; and
- controlled breeding, confinement, surgery, censorship, and execution are used to preserve the hierarchy.

The result can be read as commentary on class, aristocracy, gender, education, institutional power, and a society's tendency to mistake its conventions for laws of nature. Abbott's revised preface responded directly to contemporary criticism of the portrayal of women. It distinguished the narrator from the author, said the Square had identified himself too closely with accepted Flatland views, and disavowed the aristocratic tendencies attributed to the work.

Those statements are relevant evidence, but they do not settle every question about Abbott's intentions or every modern response to the book. Modern scholarship commonly discusses *Flatland* as social satire. This project presents the source record, identifies its own adaptation choices, and leaves readers free to judge the text.

For the detailed chapter references, source-versus-project map, and historical scholarship, see [Source and adaptation notes](docs/SOURCE_AND_CONTEXT.md). Useful external starting points include the [complete Project Gutenberg edition](https://www.gutenberg.org/ebooks/97), the Open University's discussion of [women's status, Victorian education, and social satire](https://www.open.ac.uk/blogs/MathEd/index.php/2022/09/12/flatland-as-social-satire-womens-status-in-victorian-times-and-the-push-for-educational-reform-by-xiang-fu/), and Thomas Banchoff's [mathematical and biographical introduction](https://www.math.brown.edu/tbanchof/abbott/Flatland/Publications/intros/banchoff.pdf).

## How this adaptation responds

The simulation takes the dimensional thought experiment from the book, not its social hierarchy.

| Element | In Abbott's text | In this project |
| --- | --- | --- |
| A world confined to a plane | Flatlanders cannot rise above or sink below their surface. | The authoritative world, collision, routes, and interventions are planar. |
| Access to a sealed 2D space | The Sphere enters a locked cupboard and lifts the Square from the plane. | The visitor can lift a citizen across the Closed Room boundary without cutting its wall. |
| A fourth spatial dimension | The Square argues for a further direction by analogy. | The sealed-box case is explained as a hypothetical extension, not presented as physics or simulated fact. |
| Geometric social rank | Sex, occupation, status, and rights are assigned through shape and regularity. | Shape is a visual and geometric property only; it does not determine gender, intelligence, worth, rights, or occupation. |
| Historical source | The narrator presents Flatland's institutions from inside their culture. | The original text remains available unchanged, accompanied by optional context and a clear adaptation boundary. |

Inside the application, **Source and context** opens a dedicated explanation of the locked-room analogy, its 2D-to-3D demonstration, the further 4D argument, the relevant passages in sections 17 and 19, the book's social structure, and the choices made by this adaptation. It also links directly into the corresponding book chapters. The context is available without becoming a gate: readers can always open the complete historical text directly.

## The experience

- **Town view** follows autonomous citizens, surveys the town from above, and frames the plane as an engraved 1884 map.
- **Find citizen** searches live intent and destination data, then locates, follows, or picks up a resident directly.
- **Native vision** approximates what a resident confined to the plane could see, with planar walls providing occlusion.
- **Edit walls** makes boundaries state-aware: remove an existing wall or add one across an opening, then watch every affected route replan.
- **Dimensional manipulation** lifts a selected citizen out of the plane and returns them elsewhere without crossing an intervening wall.
- **Character creation** adds new citizens to the same schedules, needs, movement rules, and local save system as the original population.
- **Read the book** opens the complete illustrated Project Gutenberg edition with its header, footer, source notice, and license retained.

The town contains homes, workplaces, civic buildings, public spaces, and deterministic resident schedules. Versioned browser-local saves retain topology, routines, player-created citizens, and camera state. No account, tracking identity, or server-side save is required.

Desktop shortcuts are surfaced contextually in the application: `E` picks up the selected citizen, `F` follows, `T` opens wall editing, `Ctrl`/`⌘` + `Z` undoes a plane change, and `Space` places and releases a carried citizen. On phones and tablets, the same actions are presented through touch-oriented controls.

## Simulation and technology

- React 19, TypeScript, Vite, Three.js, React Three Fiber, and Drei
- Deterministic 30 Hz simulation in a Web Worker
- Local A* navigation over editable region topology
- Spatial-hash avoidance and explicit AI/player control transitions
- Two-dimensional collision and intervention rules independent of the 3D camera
- Versioned browser-local persistence
- Blender-authored planar materials baked to compact color and normal textures
- Vitest unit and component coverage for simulation, geometry, topology, controls, persistence, and guided interactions

## Run locally

Requirements:

- Node.js 22.12 or later
- pnpm 11 (the repository pins the package-manager version)

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Vite serves the application on `http://127.0.0.1:5173` by default.

Run the complete release verification suite:

```powershell
pnpm verify
```

That command validates required public-release files and dependency licenses, runs the tests, and creates a production build.

Rebuild the optional planar material library with Blender 4.5 or later:

```powershell
blender --background --python scripts/blender/build_flatworld.py
```

## Repository layout

- `src/simulation/` — deterministic society, topology, geometry, navigation, and worker
- `src/components/` — planar renderer, reader, camera views, dialogs, controls, and source-context experience
- `public/books/flatland/` — complete Project Gutenberg HTML edition and source record
- `public/assets/materials/` — optimized runtime color and normal textures
- `art_source/` — editable Blender material source and historical prototypes
- `scripts/blender/` — reproducible Blender material build
- `docs/` — source context, rights map, and publication checklist
- `flatworld_simulation_technical_spec_v0_2.md` — original product and simulation brief

## Contributing and security

Contributions that strengthen the dimensional simulation, accessibility, historical accuracy, or documentation are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), and use [SECURITY.md](SECURITY.md) for private vulnerability reports. Changes that characterize the book or its history should cite the primary text or reliable scholarship and clearly distinguish Abbott's work from project-created examples.

## Rights and licenses

Original project code, documentation, and assets are licensed under the [MIT License](LICENSE), unless a file says otherwise. The bundled book is not relicensed under MIT: Project Gutenberg identifies ebook 97 as public domain in the USA, and its retained Project Gutenberg notice and license govern use of that distributed edition. Copyright status can differ outside the United States.

See the [rights map](docs/RIGHTS.md) and [third-party notices](THIRD_PARTY_NOTICES.md) before redistributing the complete repository or a built release.
