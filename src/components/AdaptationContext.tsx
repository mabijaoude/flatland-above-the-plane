import { ArrowLeft, ArrowRight, BookOpenText, ExternalLink, X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { BookChapterId } from "./BookReader";

const BOOK_URL = "https://www.gutenberg.org/ebooks/97";
const OPEN_UNIVERSITY_URL = "https://www.open.ac.uk/blogs/MathEd/index.php/2022/09/12/flatland-as-social-satire-womens-status-in-victorian-times-and-the-push-for-educational-reform-by-xiang-fu/";

type AdaptationContextProps = {
  onClose: () => void;
  onReadBook: (chapter?: BookChapterId) => void;
};

function focusableElements(container: HTMLElement | null) {
  return [...(container?.querySelectorAll<HTMLElement>(
    "button, [href], [tabindex]:not([tabindex='-1'])"
  ) ?? [])].filter((element) => !element.hasAttribute("disabled") && !element.hasAttribute("inert"));
}

export function AdaptationContext({ onClose, onReadBook }: AdaptationContextProps) {
  const dialog = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => dialog.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      const target = previousFocus.current;
      requestAnimationFrame(() => {
        if (target?.isConnected) target.focus();
      });
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableElements(dialog.current);
    if (!focusable.length) {
      event.preventDefault();
      dialog.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const closeFromScrim = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="dialog-scrim adaptation-context-scrim" role="presentation" onPointerDown={closeFromScrim}>
      <section
        id="flatland-adaptation-context"
        ref={dialog}
        className="adaptation-context parchment-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adaptation-context-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="panel-heading adaptation-context__heading">
          <div>
            <p className="eyebrow">Source and context</p>
            <h2 id="adaptation-context-title">The locked-room analogy</h2>
          </div>
          <button type="button" aria-label="Close source and context notes" onClick={onClose}><X /></button>
        </div>

        <p className="adaptation-context__lead">
          This project makes one geometric idea from Edwin A. Abbott's <cite>Flatland</cite> playable:
          an enclosure sealed to a 2D resident can be entered or exited through a third spatial dimension.
          It explores this analogy, not the novel's Victorian social order.
        </p>

        <section className="dimensional-demonstration" aria-labelledby="dimensional-demonstration-title">
          <div className="dimensional-demonstration__heading">
            <p className="eyebrow">What the simulation demonstrates</p>
            <h3 id="dimensional-demonstration-title">The same enclosure, different degrees of freedom</h3>
            <p>The boundary stays fixed; only the available motion changes.</p>
          </div>
          <div className="dimension-stage dimension-stage--plane">
            <span className="dimension-stage__badge">2D</span>
            <p className="dimension-stage__label">2D resident</p>
            <h4>Every route out meets the wall.</h4>
            <p>
              The resident can move in two independent spatial dimensions, but cannot leave the plane.
              Every route into or out of the enclosure crosses its boundary.
            </p>
          </div>
          <div className="dimension-stage__transition" aria-hidden="true"><ArrowRight /></div>
          <div className="dimension-stage dimension-stage--space">
            <span className="dimension-stage__badge">3D</span>
            <p className="dimension-stage__label">3D visitor</p>
            <h4>A third spatial dimension provides another path.</h4>
            <p>
              Move the resident out of the plane, cross the boundary, and return on the other side.
              The resident never passes through the two-dimensional wall.
            </p>
          </div>
        </section>

        <aside className="fourth-dimension-note" aria-labelledby="fourth-dimension-title">
          <span className="dimension-stage__badge">4D</span>
          <div>
            <p className="eyebrow">A further analogy — not simulated</p>
            <h3 id="fourth-dimension-title">Could a fourth spatial dimension bypass a sealed surface?</h3>
            <p>
              We move through three spatial dimensions. By analogy, a hypothetical four-dimensional visitor could use
              another spatial dimension to enter or leave a sealed three-dimensional enclosure without crossing its surface.
              The application does not simulate 4D geometry, and this geometric analogy is not evidence that such visitors exist.
            </p>
          </div>
        </aside>

        <section className="adaptation-context__model-scope" aria-labelledby="model-scope-title">
          <h3 id="model-scope-title">What this simulation models</h3>
          <div>
            <p><strong>Playable</strong><span>A 2D resident can be lifted into 3D and returned across a boundary.</span></p>
            <p><strong>Analogy only</strong><span>The corresponding 3D-to-4D case is described, not simulated.</span></p>
          </div>
        </section>

        <div className="adaptation-context__grid">
          <section>
            <h3>Where it appears in the book</h3>
            <div className="source-passage">
              <p className="source-passage__label"><span>Section 17</span><strong>Cupboard demonstration</strong></p>
              <p>
                The Sphere enters a locked cupboard while “the doors … remain unmoved,” removes a tablet,
                and later lifts the Square out of the plane. This is the direct source for the playable interaction.
              </p>
              <button type="button" onClick={() => onReadBook("chap17")}>Read section 17 <ArrowRight aria-hidden="true" /></button>
            </div>
            <div className="source-passage">
              <p className="source-passage__label"><span>Section 19</span><strong>Fourth-dimension argument</strong></p>
              <p>
                The Square asks whether higher-dimensional beings could enter closed rooms “without the opening of
                doors or windows.” The Sphere says only that such appearances are reported and disputed.
                The book presents the 4D case as conjecture, not a demonstrated event.
              </p>
              <button type="button" onClick={() => onReadBook("chap19")}>Read section 19 <ArrowRight aria-hidden="true" /></button>
            </div>
          </section>

          <section>
            <h3>The book's historical setting</h3>
            <p>
              <cite>Flatland</cite> represents women as straight lines. Male social class is encoded through polygonal form,
              regularity, and number of sides. The revised preface addresses criticism of this portrayal: it says the Square
              later modified his views about women and the lower classes and had identified himself “perhaps too closely”
              with views generally accepted in Flatland.
            </p>
            <p>
              That is the source text's own framing. Readers can judge the book and its satire for themselves; the
              <a href={OPEN_UNIVERSITY_URL} target="_blank" rel="noreferrer"> Open University overview <ExternalLink aria-hidden="true" /></a>
              gives additional historical context.
            </p>
          </section>
        </div>

        <section className="adaptation-context__choices" aria-labelledby="project-choices-title">
          <h3 id="project-choices-title">Project choices</h3>
          <p>The simulation takes the dimensional thought experiment from the book, not its social hierarchy.</p>
          <ul>
            <li>The simulation does not reproduce or endorse the source's sex- and class-based hierarchy.</li>
            <li>Shape and side count are geometric properties only; they do not encode the novel's gender or class rankings.</li>
            <li>The complete historical text remains available unchanged so readers can assess the source for themselves.</li>
          </ul>
        </section>

        <div className="adaptation-context__actions">
          <button type="button" className="button-primary" onClick={onClose}><ArrowLeft aria-hidden="true" />Return to Flatland</button>
          <button type="button" className="button-secondary" onClick={() => onReadBook()}><BookOpenText aria-hidden="true" />Open the full book</button>
          <a href={BOOK_URL} target="_blank" rel="noreferrer">Project Gutenberg source <ExternalLink aria-hidden="true" /></a>
        </div>
        <p className="adaptation-context__legal">
          <a href="/PROJECT_LICENSE.txt" target="_blank" rel="noreferrer">Project license</a>
          <span aria-hidden="true">·</span>
          <a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">Third-party notices</a>
        </p>
      </section>
    </div>
  );
}
