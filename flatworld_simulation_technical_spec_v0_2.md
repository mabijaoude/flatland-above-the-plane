# Flatworld Simulation — Technical Design and Code Specification

**Working title:** *Flatworld: Above the Plane*  
**Specification version:** 0.2  
**Reference implementation:** Godot 4.7.x, typed GDScript  
**Primary target:** Desktop; architecture remains engine-neutral where practical

---

## 1. Product definition

*Flatworld: Above the Plane* is a systemic sandbox simulation of a civilization whose inhabitants, buildings, movement, senses, and physics are confined to a two-dimensional plane.

The player may:

1. **Inhabit a native shape** and experience the world through limited planar senses.
2. **Observe from three dimensions** using a free-flying camera unavailable to any ordinary resident.
3. **Intervene from above** by lifting residents out of the plane, carrying them across otherwise impassable boundaries, placing them into or out of sealed spaces, and altering wall topology.
4. **Observe social consequences** as residents interpret disappearances, impossible relocations, new openings, and cross-sections of three-dimensional visitors.

The project is not a scene-based puzzle with scripted crowds. It is a persistent simulation in which residents have homes, jobs, schedules, relationships, memories, beliefs, and reactions to dimensional events.

At the world origin, a permanent **Dedication District** acknowledges the source work using landscape-scale geometry that reads from above as *Flatland: A Romance of Many Dimensions — Edwin A. Abbott — First published 1884*. The district is part of the actual navigable city rather than a menu label, floating caption, or decorative texture. Native residents experience only its local streets, walls, plazas, and buildings; the overhead player can perceive the complete attribution at once.

---

## 2. Adaptation principles

### 2.1 Non-gendered society

The original book's gender hierarchy is not reproduced.

- Shape, side count, job, education, authority, mobility, and legal status are never linked to sex or gender.
- Residents may use neutral identities by default. Optional names and pronouns are cosmetic and have no mechanical effect.
- Line-segment residents may exist as a geometric class, but they are not identified with women and have equal civil standing in the default scenario.
- No shape is inherently more intelligent, moral, emotionally stable, or valuable than another.

### 2.2 Preserve the social analogy without endorsing it

A scenario may contain a hierarchy based on side count, regularity, wealth, ancestry, office, or educational credentials. These are represented as **social beliefs and institutional policies**, not biological facts.

For example, a ruling institution may grant more prestige to many-sided polygons, but a triangle may be just as intelligent, skilled, or ethical as a circle-like polygon. This separation is essential to the satire and to the simulation design.

### 2.3 Geometry must create real limitations

The world must not merely look two-dimensional. Native residents must be unable to:

- move over or under another object;
- cross a closed boundary without an opening;
- see a complete polygon from above;
- see through another resident or wall;
- perceive a three-dimensional object except through its intersection with the plane;
- understand an overhead view unless explicitly granted an exceptional perception state.

---

## 3. Core design pillars

### Pillar A — One world state, multiple perspectives

There is one authoritative simulation state expressed in two-dimensional coordinates. Resident mode and overhead mode are different views and control layers over the same state.

### Pillar B — Topology is gameplay

Closed loops, gaps, connected regions, and inaccessible interiors matter more than decorative walls. Opening one doorway changes the connectivity graph of the city. Lifting a resident into three dimensions bypasses that graph without teleporting through it.

### Pillar C — Knowledge is local

Residents act on limited perception and remembered information. The overhead player can know facts that no resident can directly know.

### Pillar D — Dimensional intervention leaves consequences

A resident who vanishes from a locked room and reappears outside should not simply resume as though nothing happened. The event can alter memories, beliefs, relationships, institutional activity, and local rumours.

### Pillar E — Scale through simulation levels of detail

Nearby residents receive full geometry, perception, collision, and AI updates. Distant residents advance through simplified schedule and event simulation.

### Pillar F — Attribution is part of the geography

The title, author, and original publication year are encoded into the central city's physical plan. They are immediately legible from the three-dimensional survey view but remain fragmented into ordinary local features from a resident's planar viewpoint. This turns the source credit itself into a demonstration of dimensional perspective.

---

## 4. Player modes

## 4.1 Resident Mode

The player possesses or creates a native shape.

### Capabilities

- Move forward and backward within the plane.
- Rotate.
- Interact with doors, objects, institutions, and residents.
- Follow a job or ignore the assigned schedule.
- Speak, listen, inspect by touch, and remember locations.
- Experience dimensional interventions performed by another player or scripted visitor.

### Restrictions

- No jumping, vertical movement, overhead camera, or free map knowledge.
- Walls and bodies completely block movement.
- Ordinary sight is one-dimensional and occlusion-based.
- A resident cannot directly know another resident's complete shape from a single view.

### Resident visual presentation

A mathematically strict two-dimensional observer has a one-dimensional visual field. A normal game display is two-dimensional, so the simulation presents this as an expanded **visual band**:

- horizontal screen position represents viewing angle;
- each screen column is produced by one ray cast in the world plane;
- the nearest intersected edge determines the visible sample;
- distance controls fog, contrast, and apparent detail;
- surface category, motion, and sound may add readable cues;
- the band can be vertically enlarged for comfort without implying height.

Accessibility options may add labels, directional audio, a remembered map, or a simplified top-down training view. These aids are explicitly marked as non-native information.

## 4.2 Overhead Survey Mode

The player becomes a free three-dimensional observer.

### Capabilities

- Fly above, below, and around the plane.
- Switch between perspective and orthographic cameras.
- See complete polygons, room layouts, occluded residents, and district connectivity.
- Inspect AI state, schedules, relationships, memories, and local policies.
- Pause, accelerate, or single-step simulation time.

### Important rule

The three-dimensional display is a rendering of the same two-dimensional state. Native residents remain governed by planar physics even when viewed from above.

## 4.3 Intervention Mode

Intervention Mode is a tool layer used from the overhead camera.

### Initial tools

- **Lift:** Remove a resident or portable object from the plane.
- **Carry:** Move the lifted object through three-dimensional space.
- **Reinsert:** Place it at a legal point on the plane.
- **Rotate while lifted:** Choose its planar orientation upon return.
- **Cut opening:** Split a wall segment to create a doorway.
- **Seal opening:** Restore a continuous boundary.
- **Inspect cross-section:** Display what residents can perceive of a selected 3D object.

### Optional scenario permissions

Scenarios may restrict tools. A scientific-observer scenario might allow only passive viewing. A puzzle scenario might allow lifting but not wall editing.

---

## 5. Coordinate and dimensional model

## 5.1 Canonical coordinates

The authoritative simulation uses a two-dimensional coordinate system:

```text
Flatworld position = Vector2(x, y)
Flatworld rotation = radians around the plane-normal axis
```

The Godot three-dimensional display maps the plane to `Y = 0`:

```text
Flatworld (x, y) -> Godot 3D (x, altitude, y)
```

A helper must own this conversion so mapping is never reimplemented inconsistently.

```gdscript
class_name PlaneTransform

static func to_3d(p: Vector2, altitude: float = 0.0) -> Vector3:
    return Vector3(p.x, altitude, p.y)

static func to_2d(p: Vector3) -> Vector2:
    return Vector2(p.x, p.z)
```

## 5.2 Mathematical thickness versus rendering thickness

Native objects have zero thickness in simulation. In overhead rendering they may receive a very small visual extrusion so edges remain visible and do not flicker. This extrusion:

- is never used for native collision;
- does not create climbable height;
- does not allow residents to pass above or below anything;
- is labelled internally as `render_thickness`, not physical thickness.

## 5.3 Dimensional state

Every portable planar entity has one of these states:

```gdscript
enum DimensionalState {
    ON_PLANE,
    BEING_LIFTED,
    OFF_PLANE,
    BEING_REINSERTED
}
```

Only `ON_PLANE` entities participate in normal planar collision, pathfinding obstacles, planar sight, and planar touch.

---

## 6. Three-dimensional lifting mechanic

## 6.1 Lift sequence

1. The overhead player selects an entity.
2. The `LiftSystem` acquires an exclusive interaction lock.
3. The entity changes from `ON_PLANE` to `BEING_LIFTED`.
4. Its planar collider and navigation occupancy are disabled.
5. A 3D proxy is created or activated at the mapped world position.
6. Once altitude exceeds `plane_epsilon`, the entity becomes `OFF_PLANE`.
7. Native observers can no longer see, hear, touch, or collide with it unless a special cross-dimensional effect is active.
8. The entity is carried to a new 3D location.
9. Reentry validates the target position and orientation.
10. The 3D proxy descends to the plane.
11. The planar body is restored and the state returns to `ON_PLANE`.
12. A `DimensionalRelocationEvent` is emitted.

## 6.2 Why this bypasses a wall

A closed wall loop partitions the two-dimensional navigation space. The lifted entity is temporarily absent from that space, travels at non-zero altitude, then re-enters in a different connected region. It never crosses the wall in two dimensions.

This must be implemented as a dimensional state transition, not as ordinary teleportation. The event log should retain the lift path, altitude, source region, and destination region.

## 6.3 Placement validation

On reentry, the system checks:

- polygon-versus-wall overlap;
- polygon-versus-resident overlap;
- restricted-zone rules;
- minimum clearance;
- whether the chosen orientation fits;
- whether the target lies inside the selected room or region.

Placement modes:

- **Strict:** Reject any invalid target.
- **Assist:** Search outward for the nearest legal point.
- **Force:** Permit temporary overlap, then run deterministic separation. Intended only for debug tools.

Strict mode is the gameplay default.

## 6.4 Resident experience of lifting

By default, a resident has no normal sensory input while fully off-plane. It records:

- last planar location;
- time of disappearance;
- duration with no planar sensory data;
- first location perceived after return;
- nearby witnesses before and after the event.

A scenario may grant an `ELEVATED_PERCEPTION` condition, allowing the resident to see the overhead world temporarily. That is a narrative exception, not a normal ability.

---

## 7. Three-dimensional visitors and planar cross-sections

A true three-dimensional visitor is distinct from the overhead camera. It has a 3D body whose intersection with the plane becomes a temporary native object.

## 7.1 Sphere example

For a sphere of radius `R` whose center is a signed distance `h` from the plane:

```text
No intersection when |h| > R
Cross-section radius r = sqrt(R² - h²) when |h| <= R
```

To residents, the sphere appears as a circle that begins at a point, expands, reaches maximum size, contracts, and disappears. They never see the sphere itself.

## 7.2 General mesh intersection

For an arbitrary 3D mesh:

1. Transform mesh triangles into world space.
2. Classify each triangle vertex relative to the plane.
3. Intersect crossing edges with the plane.
4. Collect resulting line segments.
5. Weld endpoints within a tolerance.
6. Stitch segments into open chains or closed loops.
7. Convert loops into planar collision and visual geometry.
8. Update only while the 3D object or plane changes.

The MVP should support sphere, box, cylinder, and capsule primitives before arbitrary meshes.

## 7.3 Interaction rules

- The cross-section may block planar movement while present.
- Residents see only the cross-section.
- The overhead player sees both the 3D visitor and a highlighted planar slice.
- A visitor may use a grab tool to lift a resident.
- Cross-section appearance and disappearance generate witness events.

---

## 8. Native geometry and physics

## 8.1 Resident bodies

Most residents are convex polygons.

```gdscript
class_name ShapeGeometry

var kind: StringName              # line, triangle, quad, regular_polygon, custom
var vertices_local: PackedVector2Array
var side_count: int
var circumradius: float
var regularity: float             # descriptive geometry, not moral worth
var sharpness: float              # used only for collision/contact calculations
```

Regular polygons are generated procedurally. Custom polygons are validated for winding, self-intersection, and convexity.

## 8.2 Collision

Use convex polygon collision for residents and segment/polygon collision for architecture.

Required behaviours:

- orientation affects whether a resident fits through a doorway;
- no body may pass over or under another;
- crowding creates queues and congestion;
- sharp vertices affect contact geometry but should not create graphic injury;
- collision consequences may use abstract states such as `STUNNED`, `DAMAGED`, or `NEEDS_ASSISTANCE`.

For deterministic simulation tests, the core geometry library should expose polygon intersection independently of the engine physics API.

## 8.3 Spatial partitioning

Use a uniform spatial hash or quadtree for:

- nearby-agent queries;
- line-of-sight candidates;
- collision broad phase;
- sound propagation candidates;
- witness detection;
- local social interactions.

---

## 9. Buildings and city topology

## 9.1 What a building is in this world

A building is not a floor with walls rising upward. It is a set of planar boundary segments that divide navigable space.

```gdscript
class_name BuildingData

var id: int
var outer_boundary: PackedVector2Array
var internal_walls: Array[WallSegmentData]
var portals: Array[PortalData]
var rooms: Array[RoomData]
var use_type: StringName
var owner_ids: PackedInt64Array
var access_policy_id: int
```

## 9.2 Wall segment

```gdscript
class_name WallSegmentData

var id: int
var a: Vector2
var b: Vector2
var thickness_visual: float
var material_id: StringName
var blocks_movement: bool = true
var blocks_sight: bool = true
var blocks_sound_factor: float = 0.7
```

## 9.3 Portal

A portal is a gap or controlled crossing in a boundary.

```gdscript
class_name PortalData

var id: int
var wall_id: int
var start_t: float
var end_t: float
var is_open: bool
var access_policy_id: int
var connected_region_a: int
var connected_region_b: int
```

## 9.4 Creating a new exit

The `BoundaryEditSystem.create_opening()` operation:

1. validates that the requested gap lies on one wall;
2. splits the original segment into left and right segments;
3. inserts a portal between them;
4. rebuilds collision only for the affected chunk;
5. updates the visibility graph;
6. updates the region-connectivity graph;
7. refreshes local navigation;
8. emits `OpeningCreatedEvent`;
9. notifies nearby residents through normal perception.

Residents do not gain supernatural knowledge of the new exit. They discover it by seeing it, hearing others, encountering it, or receiving updated institutional information.

## 9.5 Sealed-room scenario

Acceptance behaviour:

- A resident inside a room with no open portal has no legal planar path outside.
- An overhead player can lift the resident, move over the boundary, and reinsert it outside.
- The pathfinder still reports the two planar regions as disconnected.
- The relocation event records that the resident changed connected components without traversing a portal.

---

## 10. World generation

## 10.1 World hierarchy

```text
World
  -> Central Dedication District
  -> Districts
      -> Blocks
          -> Buildings
              -> Rooms and portals
      -> Roads and public spaces
  -> Institutions
  -> Residents
  -> Resources and services
```

## 10.2 Generation constraints

- All navigable regions must be valid planar polygons.
- Roads must have sufficient width for expected traffic.
- Buildings may be convex or concave, but wall loops may not self-intersect.
- Door widths should create meaningful accessibility differences among body shapes.
- Public facilities require at least one reachable entrance in normal scenarios.
- Puzzle scenarios may intentionally contain sealed regions.
- The generator must be seeded for reproducibility.

## 10.3 Suggested building types

- homes;
- workshops;
- schools;
- markets;
- clinics;
- meeting halls;
- archives;
- transport depots;
- parks or open commons;
- research institutes studying dimensional events.

## 10.4 Environmental recognition

Fog, sound, road texture, directional pull, and recurring landmarks may support navigation. Fog is mechanically useful because distance-based contrast can help residents distinguish edge arrangements.


## 10.5 Central Dedication District

The main civic district is a landscape-scale attribution to the public-domain source work. Its canonical metadata is:

```text
FLATLAND
A ROMANCE OF MANY DIMENSIONS
EDWIN A. ABBOTT
FIRST PUBLISHED 1884
```

The full bibliographic title stored by the simulation is `Flatland: A Romance of Many Dimensions`.

### Design intent

- The district occupies the world origin and acts as the primary visual anchor of the map.
- It must be unmistakably readable from the default three-dimensional arrival view.
- It must be made from actual world geometry, not merely painted onto the screen.
- It must continue functioning as a district in which residents travel, work, meet, and live.
- An ordinary resident should perceive local streets and boundaries without being granted an impossible top-down reading of the complete inscription.
- The landmark contains no gender-based or sexist mechanics; it is strictly an attribution and dimensional-perspective feature.

### Spatial composition

The default composition uses four nested scales:

1. `FLATLAND` is the largest line and forms the central civic axis.
2. `A ROMANCE OF MANY DIMENSIONS` forms a secondary band of smaller but still traversable glyph districts.
3. `EDWIN A. ABBOTT` forms the author promenade.
4. `FIRST PUBLISHED 1884` forms the southern publication-year plaza.

The complete dedication should occupy roughly the central 25–35 percent of the initial playable world. The exact percentage is configurable, but the full inscription must fit comfortably within the default overhead camera's framing safe area.

### Geometry construction

- Text is authored as a custom geometric vector alphabet made from simple polygons and polylines.
- Glyph strokes become broad public paths, plazas, courtyards, planted commons, and building rows.
- Glyph boundaries are represented by ordinary wall and parcel geometry, so they participate in collision, visibility, navigation, and topology.
- Letter interiors such as those in `A`, `D`, `O`, and `R` must not accidentally become inaccessible regions. Each ordinary enclosed counter receives at least two valid portals unless a scenario deliberately marks it as a sealed puzzle space.
- Stroke widths, spacing, and corner radii are chosen for both overhead readability and resident traffic capacity.
- The dedication generator reserves clear negative space around each line so nearby procedural buildings cannot destroy legibility.
- The generated layout is deterministic for a given content and world seed.

A road-surface or plaza-fill layer may reinforce the glyph silhouette from above, but this layer is generated from the same authoritative vector paths. It is a presentation aid, not a separate fake inscription.

### Resident-scale experience

Residents do not normally know that their entire district spells a title. They encounter places with local identities such as:

- Flatland Central;
- Dimensions Hall;
- Abbott Promenade;
- the 1884 Commons;
- individual letter plazas and neighbourhood blocks.

A surveyor, researcher, or resident temporarily granted elevated perception may infer the larger structure. This can become a narrative or scientific discovery without changing the normal limits of planar sight.

### Guaranteed overhead visibility

The overhead renderer must provide all of the following:

- a default arrival camera centred on the dedication;
- an orthographic **Frame Dedication** camera command;
- a high-distance level-of-detail proxy generated from the same vector geometry;
- render-only edge extrusion sufficient to prevent z-fighting;
- a dedicated landmark contrast profile that remains legible against surrounding terrain;
- exclusion of procedural clutter from the dedication's protected visual buffer;
- optional subtle night illumination following the real glyph paths.

The level-of-detail proxy may simplify walls and residents at high altitude, but it may not change the wording, arrangement, or location of the attribution.

### Editing and preservation

In standard simulation scenarios, the district is tagged as a civic heritage landmark. Normal construction systems may alter interiors and doors but warn before deleting a glyph-defining boundary. Creative mode may disable this protection.

When a wall edit changes the landmark silhouette:

1. update affected topology and navigation as usual;
2. mark the corresponding dedication glyph dirty;
3. regenerate only the affected overhead level-of-detail geometry;
4. save the altered form as part of world state;
5. optionally emit a `DEDICATION_GEOMETRY_CHANGED` civic event.

### Data model

```gdscript
class_name DedicationLandmarkData

var work_title: String = "Flatland: A Romance of Many Dimensions"
var display_title: String = "FLATLAND"
var display_subtitle: String = "A ROMANCE OF MANY DIMENSIONS"
var author: String = "Edwin A. Abbott"
var first_publication_year: int = 1884

var district_id: int
var glyph_paths: Array[PackedVector2Array]
var world_transform: Transform2D
var visual_buffer: float
var protected_in_standard_play: bool = true
var geometry_revision: int = 1
```

The attribution strings and year are content data rather than hard-coded into renderer logic, allowing localization or alternate public-domain editions while preserving the canonical English default.

---

## 11. Resident data model

```gdscript
class_name ResidentData

var id: int
var display_name: String
var geometry_id: int
var position: Vector2
var rotation: float
var velocity: Vector2
var dimensional_state: DimensionalState

var home_building_id: int
var workplace_id: int
var role_id: StringName
var institution_ids: PackedInt64Array

var traits: TraitSet
var skills: SkillSet
var needs: NeedState
var schedule: DailySchedule
var relationships: Dictionary       # resident_id -> RelationshipData
var memory: MemoryStore
var beliefs: BeliefModel
var current_goal: GoalData
var current_action: ActionData
var status_effects: Array[StatusEffect]
```

### 11.1 Traits independent of shape

Examples:

- curiosity;
- patience;
- sociability;
- caution;
- persistence;
- openness to anomalous evidence;
- conformity;
- empathy.

These must be generated independently from side count and class.

### 11.2 Skills

Examples:

- navigation;
- visual edge recognition;
- tactile identification;
- teaching;
- construction;
- medicine;
- administration;
- research;
- negotiation.

Shape may affect physical fit or edge visibility, but not base intellectual potential.

### 11.3 Needs

Use abstract, game-readable needs:

- rest;
- nourishment or energy;
- safety;
- belonging;
- purpose;
- curiosity;
- autonomy.

Needs drive behaviour without requiring detailed biological simulation.

---

## 12. Daily life and AI

## 12.1 AI approach

Use a hybrid of schedules, utility selection, and short action sequences.

1. **Schedule** proposes expected activities.
2. **Needs** and emergencies modify priority.
3. **Utility scoring** selects a goal.
4. **Planner** chooses a short sequence of actions.
5. **Navigation** provides a path to the next target.
6. **Action executor** performs movement and interaction.

This is easier to debug than an unrestricted planner and more flexible than a pure finite-state machine.

## 12.2 Example day

```text
06:00 Rest at home
07:00 Prepare and socialize with household
08:00 Travel to work or school
09:00 Perform role activity
12:00 Visit market or common area
13:00 Resume work
17:00 Travel home
18:00 Social, civic, educational, or leisure activity
22:00 Rest
```

Schedules are templates, not commands. A blocked road, new opening, dimensional event, urgent need, or social conflict may alter the day.

## 12.3 Utility example

```gdscript
func score_goal(resident: ResidentData, goal: GoalDefinition) -> float:
    var score := goal.base_weight
    score += goal.need_curve.evaluate(resident.needs.get_value(goal.need_key))
    score += goal.trait_modifiers.score(resident.traits)
    score += goal.context_score(resident)
    score -= goal.estimated_cost(resident)
    return score
```

## 12.4 AI update rates

Suggested logical rates:

- nearby movement and collision: fixed physics tick;
- local steering: 10–20 updates per second;
- utility reevaluation: 1–4 updates per second;
- perception refresh: 2–10 updates per second depending on distance;
- social and economic systems: lower-frequency batched updates;
- distant residents: event-based schedule advancement.

Rates are configuration values, not hard-coded constants.

---

## 13. Navigation

## 13.1 Hierarchical navigation

Use two layers:

1. **Region graph:** districts, rooms, roads, and portals as connected nodes.
2. **Local navigation:** exact movement inside the current chunk or region.

A long route first chooses a region/portal sequence, then computes local paths as needed.

## 13.2 Dynamic topology

Opening or sealing a doorway should not rebuild the entire world.

- mark affected chunks dirty;
- update local collision;
- update only altered region connections;
- refresh paths whose portal sequence uses the changed edge;
- allow unaffected residents to continue.

## 13.3 Body-dependent traversal

A portal query accepts the resident geometry and orientation constraints.

```gdscript
func can_traverse_portal(
    geometry: ShapeGeometry,
    portal: PortalData,
    approach_angle: float
) -> bool:
    var required_width := GeometryFit.minimum_cross_section_width(
        geometry,
        approach_angle
    )
    return portal.world_width() >= required_width
```

Residents may rotate to fit where space permits. This produces native two-dimensional navigation puzzles without artificial keys.

---

## 14. Perception

## 14.1 Sight

Resident sight uses planar ray casting.

For each sample angle:

1. construct a ray from the eye point;
2. query candidate edges from the spatial index;
3. find the nearest intersection;
4. record distance, surface type, edge orientation, motion, and identity confidence;
5. apply fog and sensory skill;
6. update working memory.

A resident cannot see through the nearest edge.

## 14.2 Identity recognition

Recognition confidence combines:

- voice;
- known movement pattern;
- visible edge sequence over time;
- touch information;
- location and schedule expectations;
- prior relationship.

This avoids giving residents the overhead player's perfect knowledge.

## 14.3 Hearing

Sound events contain:

```gdscript
class_name SoundEvent

var origin: Vector2
var base_loudness: float
var category: StringName
var source_id: int
var semantic_payload_id: int
```

Propagation is attenuated by distance and walls. Exact wave simulation is unnecessary for the MVP.

## 14.4 Touch

Touch is a close-range geometry query that can reveal local edge orientation or a vertex. It may be used for identification, inspecting walls, or finding openings in poor visibility.

## 14.5 Memory

Residents store observations rather than omniscient facts.

```gdscript
class_name MemoryRecord

var event_type: StringName
var subject_id: int
var position: Vector2
var timestamp: float
var confidence: float
var source_type: StringName       # direct sight, sound, touch, report, rumour
var emotional_weight: float
```

Memories decay, merge, and may conflict.

---

## 15. Society and hierarchy

## 15.1 Institutional status model

The simulation may model a biased society, but bias is stored in policy data.

```gdscript
class_name StatusPolicy

var side_count_weight: float
var regularity_weight: float
var wealth_weight: float
var office_weight: float
var education_weight: float
var ancestry_weight: float
var reform_level: float
```

A resident's **institutionally assigned status** is separate from personal competence and worth.

```gdscript
class_name SocialStanding

var institutional_status: float
var local_reputation: float
var professional_reputation: float
var wealth: float
var offices: PackedStringArray
```

## 15.2 Default social presets

### Geometric hierarchy

Many-sided and highly regular shapes receive greater institutional privilege. This is presented as an unfair convention maintained by institutions.

### Reform era

The society is actively removing shape-based restrictions. Residents and institutions disagree about the pace and meaning of reform.

### Egalitarian civic model

Side count has no legal or occupational effect. Geometry still creates physical differences in movement and perception.

### Custom

Players or scenario authors configure policy weights, rights, education access, and occupational rules.

## 15.3 Belief change

Dimensional events can affect beliefs such as:

- trust in official explanations;
- belief in higher dimensions;
- confidence in personal perception;
- support for reform;
- interest in scientific investigation;
- fear of inaccessible forces.

Belief change depends on direct evidence, social trust, existing worldview, and institutional response.

---

## 16. Economy and institutions

The MVP uses a simplified resource economy.

### Resources

- energy or food tokens;
- building materials;
- service capacity;
- household funds;
- institution budgets.

### Institutions

- civic council;
- school;
- market;
- clinic;
- construction guild;
- archive;
- dimensional research society;
- public safety service.

Institutions have staff, schedules, policies, queues, and records. They are not merely decorative buildings.

---

## 17. Event system

All important changes emit immutable events.

```gdscript
class_name SimEvent

var id: int
var type: StringName
var simulation_time: float
var position: Vector2
var actor_ids: PackedInt64Array
var payload: Dictionary
```

### Required event types

- resident entered or exited building;
- portal opened or sealed;
- route became unavailable;
- resident lifted;
- resident left plane;
- resident reinserted;
- impossible relocation witnessed;
- 3D cross-section appeared or changed;
- institution issued statement;
- dedication geometry changed;
- rumour transmitted;
- relationship changed;
- belief updated;
- resident required assistance.

Events feed:

- resident memories;
- UI notifications;
- save/replay;
- debugging tools;
- analytics;
- narrative triggers.

---

## 18. Rendering architecture

## 18.1 One simulation, three presentations

1. **Planar debug/top-down renderer:** developer and accessibility view.
2. **Resident perception renderer:** 1D ray-derived visual band.
3. **Overhead 3D renderer:** plane, extruded outlines, 3D visitors, and intervention tools.

No renderer owns authoritative state.

## 18.2 Godot scene tree

```text
Main
├── SimulationHost
├── World2DView
│   ├── Terrain2D
│   ├── DedicationLandmark2D
│   ├── Buildings2D
│   ├── ResidentBatch2D
│   └── DebugOverlay2D
├── World3DView
│   ├── PlaneMesh
│   ├── DedicationLandmark3D
│   ├── Buildings3D
│   ├── ResidentBatch3D
│   ├── Visitor3DRoot
│   ├── OverheadCamera
│   └── InterventionGizmos
├── ResidentPerceptionViewport
│   └── PerceptionBandUI
├── UI
│   ├── ModeSwitcher
│   ├── InspectorPanel
│   ├── TimelineControls
│   ├── EventLog
│   └── AccessibilityPanel
└── Audio
```

## 18.3 Rendering many residents

Nearby selected residents may use individual nodes. Unselected or distant residents should be batched by shape type and visual style. The render proxy reads transforms from simulation snapshots rather than turning every distant resident into a full scene node.

## 18.4 Visual truth indicators

The UI should distinguish:

- **native-visible information**;
- **remembered or inferred information**;
- **overhead-only information**;
- **debug information**.

This prevents the player from confusing accessibility aids with what a resident actually knows.


## 18.5 Dedication landmark rendering

`DedicationLandmark2D` and `DedicationLandmark3D` are presentation proxies over one `DedicationLandmarkData` object.

- The 2D proxy displays ordinary roads, walls, parcels, and civic spaces.
- The resident perception renderer samples those same edges without inserting readable overhead text.
- The 3D proxy displays the complete landscape-scale inscription and switches to a simplified vector mesh at high altitude.
- A visual-regression reference image is maintained for the default overhead camera so changes to world generation cannot silently obscure the title, author, or year.
- Selecting **Frame Dedication** moves only the camera; it does not pause, relocate, or reveal new information to residents.

---

## 19. Systems architecture

## 19.1 Simulation systems

```text
SimulationClock
GeometryKernel
SpatialIndex
PlanarPhysicsSystem
TopologySystem
NavigationSystem
PerceptionSystem
MemorySystem
UtilityAISystem
ScheduleSystem
ActionSystem
RelationshipSystem
SocietySystem
EconomySystem
InstitutionSystem
DimensionalTransitionSystem
PlaneIntersectionSystem
EventBus
SaveReplaySystem
```

## 19.2 Update order

At each fixed simulation step:

```text
1. Read queued player and script commands
2. Apply dimensional interventions
3. Apply boundary/topology edits
4. Rebuild dirty local spatial and navigation data
5. Advance scheduled and utility decisions due this step
6. Advance path following and steering
7. Resolve planar movement and collision
8. Process interactions
9. Update due perception queries
10. Write memories and belief reactions
11. Run due social, institutional, and economic batches
12. Emit and finalize events
13. Publish immutable render snapshot
```

This order prevents a lifted resident from colliding in the same step after its collider should have been removed.

## 19.3 Commands instead of direct mutation

Player controls and UI submit commands.

```gdscript
class_name SimCommand

var type: StringName
var issued_at: float
var issuer_id: int
var payload: Dictionary
```

Examples:

- `MOVE_RESIDENT`
- `INTERACT_WITH_PORTAL`
- `BEGIN_LIFT`
- `UPDATE_LIFT_TRANSFORM`
- `REINSERT_ENTITY`
- `CREATE_OPENING`
- `SEAL_OPENING`
- `POSSESS_RESIDENT`

The simulation validates each command before changing state.

---

## 20. Suggested project layout

```text
res://
  core/
    geometry/
      polygon_math.gd
      intersections.gd
      fit_queries.gd
      spatial_hash.gd
    simulation/
      simulation_host.gd
      simulation_clock.gd
      world_state.gd
      commands.gd
      events.gd
    agents/
      resident_data.gd
      needs.gd
      traits.gd
      schedules.gd
      utility_ai.gd
      actions.gd
      memory.gd
      beliefs.gd
    world/
      building_data.gd
      topology_system.gd
      navigation_system.gd
      generation/
    dimensions/
      lift_system.gd
      plane_transform.gd
      plane_intersection_system.gd
      visitor_3d_data.gd
    society/
      status_policy.gd
      institutions.gd
      economy.gd
      relationships.gd
    persistence/
      save_format.gd
      replay_log.gd
  presentation/
    planar_2d/
    resident_view/
    overhead_3d/
    ui/
  scenes/
  data/
    shapes/
    roles/
    institutions/
    schedules/
    society_presets/
    dedication/
      flatland_attribution.tres
      geometric_alphabet.tres
  tests/
    geometry/
    topology/
    navigation/
    dimensions/
    ai/
    persistence/
```

---

## 21. Key interfaces

## 21.1 Lift system

```gdscript
class_name LiftSystem

signal lift_started(entity_id: int)
signal entity_left_plane(entity_id: int)
signal entity_reinserted(entity_id: int, position: Vector2)

func can_lift(world: WorldState, entity_id: int) -> bool:
    var entity := world.entities.get(entity_id)
    return entity != null \
        and entity.portable \
        and entity.dimensional_state == DimensionalState.ON_PLANE

func begin_lift(world: WorldState, entity_id: int) -> SimResult:
    if not can_lift(world, entity_id):
        return SimResult.failure("Entity cannot be lifted")

    var entity := world.entities[entity_id]
    entity.dimensional_state = DimensionalState.BEING_LIFTED
    world.planar_physics.disable_entity(entity_id)
    world.navigation.remove_dynamic_occupant(entity_id)
    world.events.emit_type("RESIDENT_LIFTED", entity.position, [entity_id])
    lift_started.emit(entity_id)
    return SimResult.success()

func mark_off_plane(world: WorldState, entity_id: int) -> void:
    var entity := world.entities[entity_id]
    entity.dimensional_state = DimensionalState.OFF_PLANE
    world.events.emit_type("RESIDENT_LEFT_PLANE", entity.position, [entity_id])
    entity_left_plane.emit(entity_id)

func try_reinsert(
    world: WorldState,
    entity_id: int,
    target: Vector2,
    rotation: float
) -> SimResult:
    var validation := world.geometry.validate_placement(
        entity_id,
        target,
        rotation
    )
    if not validation.ok:
        return validation

    var entity := world.entities[entity_id]
    entity.position = target
    entity.rotation = rotation
    entity.dimensional_state = DimensionalState.ON_PLANE
    world.planar_physics.enable_entity(entity_id)
    world.events.emit_type(
        "RESIDENT_REINSERTED",
        target,
        [entity_id],
        {"source_region": entity.last_region_id,
         "destination_region": world.topology.region_at(target)}
    )
    entity_reinserted.emit(entity_id, target)
    return SimResult.success()
```

## 21.2 Resident perception sample

```gdscript
class_name PerceptionSample

var angle: float
var hit: bool
var distance: float
var entity_id: int
var surface_category: StringName
var edge_normal: Vector2
var visibility: float
```

```gdscript
func sample_visual_band(
    eye: Vector2,
    facing: float,
    fov: float,
    sample_count: int
) -> Array[PerceptionSample]:
    var samples: Array[PerceptionSample] = []
    for i in sample_count:
        var t := float(i) / maxf(1.0, sample_count - 1.0)
        var angle := facing + lerpf(-fov * 0.5, fov * 0.5, t)
        samples.append(_cast_planar_vision_ray(eye, angle))
    return samples
```

## 21.3 Topology query

```gdscript
func planar_regions_are_connected(a: Vector2, b: Vector2) -> bool:
    var region_a := region_at(a)
    var region_b := region_at(b)
    return region_graph.has_path(region_a, region_b)
```

This query must return `false` for a sealed-room lift scenario even after an entity has been moved from one region to the other.

---

## 22. Simulation levels of detail

## 22.1 Tier 0 — Focus area

- exact polygon collision;
- full planar sight and hearing;
- local avoidance;
- individual animation and rendering;
- frequent AI updates;
- complete witness processing.

## 22.2 Tier 1 — Active district

- simplified collision footprint;
- reduced perception rate;
- portal-based path following;
- batched rendering;
- less frequent AI evaluation.

## 22.3 Tier 2 — Background world

- no continuous movement integration;
- residents advance between scheduled locations through travel-time estimates;
- social and economic effects are batched;
- important events can promote affected residents to a higher tier.

## 22.4 Promotion rule

Any resident selected by the player, directly affected by a dimensional event, or located near the active camera is promoted to Tier 0 before interaction is resolved.

---

## 23. Save, replay, and determinism

### Save contents

- world seed and generation version;
- simulation clock;
- resident and institution state;
- building and portal topology;
- dedication metadata, vector geometry revision, and any player-authored alterations;
- policy configuration;
- random-number-generator states;
- dimensional visitors;
- event-log checkpoint;
- player camera and mode state.

### Replay

Store validated commands and deterministic random seeds. Replaying from a checkpoint should reproduce the same major state transitions.

### Versioning

Every save has:

```text
schema_version
content_version
world_generator_version
```

Migration functions upgrade older saves without silently discarding unsupported data.

---

## 24. Debugging tools

Required developer overlays:

- wall and portal IDs;
- connected-region coloring;
- local navigation polygons;
- active paths;
- spatial-hash cells;
- resident field-of-view rays;
- sound attenuation paths;
- AI utility scores;
- current action and schedule;
- social standing components;
- belief confidence values;
- dimensional state;
- 3D plane-intersection loops;
- simulation-tier indicator;
- event stream filter;
- dedication glyph bounds, visual buffer, and active level of detail.

A topology debugger should answer: “Why can this resident not reach that point?”

---

## 25. Performance targets

Targets are validated on the chosen minimum desktop hardware profile.

### MVP target

- 250 fully simulated residents in the active district;
- several thousand background residents;
- stable fixed-step simulation;
- responsive overhead camera;
- resident perception band at interactive frame rate;
- local topology rebuild after one doorway edit without rebuilding the entire city.

### Scaling strategy

- batch visual instances by geometry type;
- pool render proxies and temporary arrays;
- avoid per-frame allocation in geometry and perception loops;
- update AI and perception at staggered rates;
- cache static wall queries;
- rebuild only dirty navigation chunks;
- use background simulation tiers;
- profile before replacing readable code with low-level optimization.

---

## 26. Acceptance tests

## 26.1 Geometry and topology

1. A closed wall loop creates a region disconnected from its exterior.
2. A resident inside that loop cannot generate a legal planar route outside.
3. Creating a doorway connects the two regions.
4. Sealing the doorway disconnects them again.
5. A resident's orientation can determine whether it fits through a narrow opening.

## 26.2 Dimensional movement

1. A resident can be lifted from a sealed room.
2. It becomes absent from planar collision and perception while off-plane.
3. It may be carried over the wall.
4. It may be reinserted at a legal outside point.
5. No portal traversal is recorded.
6. Source and destination regions differ.
7. Nearby witnesses receive disappearance or appearance observations according to line of sight.

## 26.3 Cross-sections

1. A sphere above the plane has no native cross-section.
2. At first contact it produces a point-sized circle.
3. At center-plane alignment it produces its maximum-radius circle.
4. The circle shrinks symmetrically as the sphere leaves.
5. Residents never receive the sphere's full geometry through normal sight.

## 26.4 Perception

1. A wall blocks residents behind it.
2. The nearest edge wins each visual ray.
3. Fog reduces confidence with distance.
4. The overhead camera can display the complete shape and hidden residents.
5. Native-visible and overhead-only UI data are distinguishable.

## 26.5 Social model

1. Changing a status policy changes institutional treatment.
2. It does not rewrite intelligence, morality, or personality traits.
3. A direct dimensional witness updates belief more strongly than a distant rumour by default.
4. Institutions can issue competing explanations.

## 26.6 Persistence

1. Saving and loading preserves wall topology and resident locations.
2. An off-plane resident remains off-plane after load.
3. Replaying a command sequence from the same checkpoint reproduces the same region transitions.


## 26.7 Dedication District

1. A newly generated default world stores the exact canonical title, author, and year: `Flatland: A Romance of Many Dimensions`, `Edwin A. Abbott`, and `1884`.
2. The default three-dimensional arrival view contains all four dedication lines inside the configured camera safe area.
3. A visual-regression test confirms that the title, author, and year remain legible at the reference overhead resolution and altitude.
4. Dedication glyph boundaries participate in normal collision, sight blocking, navigation, and topology.
5. Resident Mode receives only local planar geometry and no hidden top-down text overlay.
6. All non-puzzle enclosed glyph spaces contain legal entrances and exits.
7. Editing one glyph-defining wall refreshes only the affected landmark level-of-detail data.
8. Saving and loading preserves both the canonical metadata and any allowed world edits.

---

## 27. Vertical slice

The first complete playable slice contains:

- a compact central Dedication District whose world geometry displays the title, author, and 1884 publication year from above;
- one surrounding city block;
- four buildings, including one sealed test room;
- twenty autonomous residents of several polygon types;
- homes, workplaces, and a small public space;
- Resident Mode with planar visual band;
- Overhead Survey Mode;
- Lift, carry, rotate, and reinsert interaction;
- cut-opening and seal-opening tools;
- local pathfinding and doorway fit;
- basic schedules and needs;
- witness memory for disappear/reappear events;
- one sphere visitor demonstrating cross-sections;
- save and load;
- topology, perception, and AI debugging overlays.

The slice is successful when a resident can live a normal day, become trapped by a topology change, be rescued through the third dimension, remember the event, discuss it with another resident, and later use a newly created exit. From the default overhead arrival view, the same playable area must also read clearly as the book's title, author credit, and original publication year without presenting that complete view to ordinary residents.

---

## 28. Milestone order

### Milestone 1 — Geometry laboratory

- polygon generation;
- wall loops and doors;
- collision and fit tests;
- connected-region debugger.

### Milestone 2 — Dual perspective

- authoritative 2D world state;
- top-down debug view;
- overhead 3D view;
- resident visual band.

### Milestone 3 — Dimensional intervention

- lift state machine;
- 3D proxy;
- legal reentry;
- sealed-room bypass;
- event logging.

### Milestone 4 — Autonomous residents

- schedules;
- needs;
- utility AI;
- local navigation;
- simple interactions.

### Milestone 5 — Society and memory

- relationships;
- witness events;
- rumours;
- institutions;
- configurable status policy.

### Milestone 6 — True 3D visitors

- primitive plane intersections;
- cross-section collision;
- resident reactions;
- visitor grab interaction.

### Milestone 7 — Scale and persistence

- district streaming;
- simulation tiers;
- batching;
- save migration;
- deterministic replay tests.

---

## 29. Features deliberately outside the MVP

- multiplayer;
- unrestricted arbitrary-mesh cutting;
- fully simulated language generation;
- large-scale warfare;
- detailed biological systems;
- procedural destruction of every wall;
- a four-dimensional player mode;
- photorealistic graphics;
- every resident running full perception at all times.

These may be added after the geometry, topology, perception, and dimensional-transition systems are proven.

---

## 30. Definition of done

The project fulfils its central concept when all of the following are true:

1. A native resident experiences a convincing, restricted planar world.
2. A closed boundary is truly impassable under native movement rules.
3. The overhead player sees information unavailable to residents.
4. Lifting creates a real path through three-dimensional space rather than a disguised wall teleport.
5. Reentry can place a resident inside or outside an otherwise sealed region.
6. Three-dimensional visitors are perceived only through planar cross-sections.
7. Residents maintain routines, memories, relationships, and beliefs after intervention.
8. Social hierarchy, when enabled, is represented as institutional prejudice rather than innate worth.
9. No role, right, trait, or status is linked to gender.
10. The simulation remains inspectable, testable, saveable, and scalable.
