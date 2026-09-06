# Source and adaptation notes

This page records which ideas come from Edwin A. Abbott's *Flatland*, which parts were developed for *Flatland: Above the Plane*, and how the project handles the novella's historical social material.

It is intentionally narrow. It neither endorses the society described by the narrator nor attempts a verdict on every political, religious, or social view Abbott held.

## The source text

The primary source used by the project is [Project Gutenberg ebook 97](https://www.gutenberg.org/ebooks/97), a complete illustrated HTML edition of *Flatland: A Romance of Many Dimensions*. Project Gutenberg identifies that work as public domain in the USA. The application bundles that edition with its Gutenberg header, footer, source notice, and license intact.

## Source versus project

| Element | In Abbott's text | In this project |
| --- | --- | --- |
| A world confined to a plane | Sections 1, 5, and 6 describe Flatlanders as unable to rise above or sink below their surface and explain their line-like view. | The simulation's authoritative geometry, collisions, doors, routes, and citizens are planar. |
| Access to a locked 2D space | In [section 17](https://www.gutenberg.org/files/97/97-h/97-h.htm#chap17), the Sphere enters a locked cupboard from Space and removes a tablet while its door remains closed. | Plane tools can lift a citizen across the Closed Room boundary without cutting the wall. |
| A Flatlander lifted into 3D | Sections 17 and 18 describe the Sphere lifting the Square out of Flatland and showing him the interiors of closed spaces. | The visitor can carry and reinsert a citizen while viewing the plane from above. |
| The analogy to 4D | In [section 19](https://www.gutenberg.org/files/97/97-h/97-h.htm#chap19), the Square argues for a fourth direction and asks about higher beings entering closed rooms without opening doors or windows. | The project explains the corresponding sealed 3D box as the next step in the analogy. |
| A rescue from the Closed Room | Not narrated as a rescue scene in the book. | An interactive synthesis of the cupboard demonstration and the Square's lift into Spaceland. |
| A 4D visitor freeing us from a sealed box | Proposed by analogy, but not narrated as that exact event. | A hypothetical extension used to make the 2D → 3D → 4D progression concrete. |

## Why the geometry works

Treat a Flatlander as confined to the plane `z = 0`. A simple closed curve in that plane separates an inside from an outside. A resident who must remain at `z = 0` cannot change sides without crossing the curve. A three-dimensional visitor can instead:

1. increase `z`, leaving the plane;
2. move across the curve while `z ≠ 0`; and
3. return to `z = 0` on the other side.

The corresponding 4D model adds a coordinate `w`. A three-dimensional object confined to `w = 0` can be moved around a closed 3D surface by changing `w`, then returned. In that idealized geometry, the path never intersects the surface in ordinary 3D space.

This depends on the barrier being confined to the lower-dimensional space. A wall that also extended through the extra direction could still block the route. The example establishes a geometric possibility under its assumptions; it does not establish that a traversable fourth spatial dimension exists in nature.

## The historical social material

Part I depicts a hereditary hierarchy. Women are represented as lines; male rank and occupation are tied to polygon class; “irregularity” is treated as a defect; and the state uses arranged breeding, confinement, surgery, censorship, and execution to preserve its order. These are not incidental modern labels—the institutions and penalties are described directly in the text.

Abbott also included a “Preface to the Second and Revised Edition” that answers contemporary criticism. It explicitly says:

- “It has been objected that he is a woman-hater.”
- The narrator had “identified himself (perhaps too closely)” with the views of Flatland.
- He wished to “disavow the Circular or aristocratic tendencies” attributed to him.

Those statements support a distinction between the fictional narrator's claims and a straightforward endorsement by Abbott. They do not require readers to agree about every element of authorial intent. For further historical interpretation, the Open University describes the book as a social satire and discusses Abbott's work in education; Thomas Banchoff's introduction surveys the mathematical and biographical context.

## Choices made by this adaptation

- Shape and side count are visual and geometric properties, not measures of intelligence, morality, rights, worth, gender, or occupation.
- Citizens receive homes, work, needs, and routines without a hereditary polygon caste.
- The Closed Room is a geometry and navigation problem, not a prison for an assigned social group.
- The original book remains directly accessible and unedited as a historical source. The context page is optional and does not precede or gate the reader.
- Project copy distinguishes what Abbott actually wrote from examples developed for the simulation.

This is the project's position in one sentence: it takes the dimensional thought experiment as its subject and does not take Flatland's fictional social order as its model.

## Sources

Primary sources:

- Edwin A. Abbott, [*Flatland: A Romance of Many Dimensions*, Project Gutenberg ebook 97](https://www.gutenberg.org/ebooks/97).
- [Section 17: “How the Sphere, having in vain tried words, resorted to deeds”](https://www.gutenberg.org/files/97/97-h/97-h.htm#chap17).
- [Section 19: “How, though the Sphere shewed me other mysteries of Spaceland, I still desire more”](https://www.gutenberg.org/files/97/97-h/97-h.htm#chap19).
- “Preface to the Second and Revised Edition,” included near the end of the [complete Gutenberg HTML text](https://www.gutenberg.org/files/97/97-h/97-h.htm).

Historical and mathematical context:

- Xiang Fu, [“Flatland as social satire: Women's status in Victorian times and the push for educational reform”](https://www.open.ac.uk/blogs/MathEd/index.php/2022/09/12/flatland-as-social-satire-womens-status-in-victorian-times-and-the-push-for-educational-reform-by-xiang-fu/), Open University Mathematics Education, 2022.
- Thomas F. Banchoff, [“Flatland: A New Introduction”](https://www.math.brown.edu/tbanchof/abbott/Flatland/Publications/intros/banchoff.pdf), 1991.
- University of St Andrews, [“Edwin Abbott Abbott”](https://mathshistory.st-andrews.ac.uk/Biographies/Abbott/), MacTutor History of Mathematics Archive.

Source links last checked 2026-08-11.
