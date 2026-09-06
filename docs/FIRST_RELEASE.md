# First public release

Prepared copy, not a published release or announcement. The current package version is `0.2.0`; choose the corresponding first public tag only after approving repository visibility and verifying the release.

## Release description

**Flatland: Above the Plane — a dimensional thought experiment you can play.**

Explore a living two-dimensional town inspired by Edwin A. Abbott's 1884 *Flatland*. Follow autonomous geometric citizens, see their restricted Native vision, change boundaries, or lift a resident into a direction their world does not contain.

This first public snapshot includes:

- a guided first visit, town simulation, citizen search/follow/control, and a town Gazette;
- wall editing, route replanning, undo, and lift-and-return interventions;
- character creation and browser-local saves;
- the complete illustrated novella, with chapter navigation and remembered reading settings;
- an optional page connecting the dimensional argument to the book's Victorian class and gender satire;
- keyboard and touch controls, reduced-motion reading, and recovery if the application cannot load; and
- MIT-licensed original source, contribution/reporting policies, rights notices, and automated release/browser checks.

The playable geometry is **2D-to-3D**. The **3D-to-4D** case is explained as an analogy, not simulated or presented as established physics. The town does not reproduce the novella's sex- and class-based hierarchy. The WebGL map is not fully screen-reader equivalent; physical-device and assistive-technology testing remain welcome contributions. The book retains its own Project Gutenberg notices and is not relicensed under MIT.

[Try the application](https://flatland.codefactory.synology.me/) · [Read the README](../README.md) · [Known limits and follow-up ideas](../Astra%20improvements.md)

## LinkedIn draft — use after public launch

What if a locked room was only locked because you were missing a direction?

I've been building **Flatland: Above the Plane**, an interactive browser project inspired by Edwin A. Abbott's 1884 novella. You can explore a living 2D town, follow its geometric citizens, switch to their limited view, and lift someone out of the plane to bypass a wall without opening it.

The mathematics is only half the story. *Flatland* is also a Victorian social satire about class, gender, education, and who gets to define what is possible. The application includes the complete illustrated book and a dedicated page separating the source text from the choices made in this adaptation.

This is my first open-source release. It's a small exploratory project, with no sign-up and browser-local saves. Feedback, forks, documentation improvements, and accessibility testing are welcome.

Try it: https://flatland.codefactory.synology.me/

Source: https://github.com/mabijaoude/flatland-above-the-plane

Start with the 90-second tour. I'd especially like to hear whether the change from the overhead map to Native vision changes how you think about the town.

## Owner launch actions

1. Approve making the existing GitHub repository public. This has not been done by the documentation or production-deployment approval.
2. At launch, enable private vulnerability reporting and require the **Verify** CI check on `main` where available; verify unauthenticated access to the README, images, source, and a fresh LFS clone.
3. Create the first GitHub release/tag from the verified source snapshot, using the release description above.
4. Optionally upload `public/social-preview.jpg` in the repository's **Settings → General → Social preview**. The website already declares this image for its own shared links.
5. Preview the live URL and repository link in the announcement before posting. Use a project screenshot, not private setup/email screenshots.

These actions can be assisted after authorization; account-only prompts or unavailable GitHub plan features may need the owner's involvement. See the [publishing checklist](PUBLISHING_CHECKLIST.md) for the complete record.
