import {
  ArrowRight,
  BookOpenText,
  ExternalLink,
  Info,
  Minus,
  Plus,
  X
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent
} from "react";
import { captureReadingAnchor, readingFontScale, restoreReadingAnchor, type ReadingAnchor } from "./readerPosition";
import { restoreDialogFocus } from "./dialogFocus";

const BOOK_SOURCE = "/books/flatland/index.html";
const BOOK_SOURCE_PAGE = "https://www.gutenberg.org/ebooks/97";
const BOOK_LICENSE_PAGE = "https://www.gutenberg.org/policy/license.html";
const READING_POSITION_KEY = "flatland-book-reader-position-v1";
const READING_CHAPTER_KEY = "flatland-book-reader-chapter-v1";
const READING_ANCHOR_KEY = "flatland-book-reader-anchor-v1";
const READING_SIZE_KEY = "flatland-book-reader-size-v1";

const chapters = [
  { id: "top", label: "Cover and dedication" },
  { id: "contents", label: "Contents" },
  { id: "part01", label: "Part I · This World" },
  { id: "chap01", label: "1 · The Nature of Flatland" },
  { id: "chap02", label: "2 · Climate and Houses" },
  { id: "chap03", label: "3 · The Inhabitants" },
  { id: "chap04", label: "4 · The Women" },
  { id: "chap05", label: "5 · Recognizing One Another" },
  { id: "chap06", label: "6 · Recognition by Sight" },
  { id: "chap07", label: "7 · Irregular Figures" },
  { id: "chap08", label: "8 · The Practice of Painting" },
  { id: "chap09", label: "9 · The Universal Colour Bill" },
  { id: "chap10", label: "10 · The Chromatic Sedition" },
  { id: "chap11", label: "11 · Our Priests" },
  { id: "chap12", label: "12 · The Doctrine of Our Priests" },
  { id: "part02", label: "Part II · Other Worlds" },
  { id: "chap13", label: "13 · A Vision of Lineland" },
  { id: "chap14", label: "14 · Explaining Flatland" },
  { id: "chap15", label: "15 · A Stranger from Spaceland" },
  { id: "chap16", label: "16 · The Mysteries of Spaceland" },
  { id: "chap17", label: "17 · The Sphere Resorts to Deeds" },
  { id: "chap18", label: "18 · How I Came to Spaceland" },
  { id: "chap19", label: "19 · Other Mysteries of Spaceland" },
  { id: "chap20", label: "20 · A Vision" },
  { id: "chap21", label: "21 · Teaching Three Dimensions" },
  { id: "chap22", label: "22 · Diffusing the Theory" }
] as const;

export type BookChapterId = (typeof chapters)[number]["id"];

function savedChapter(): BookChapterId {
  if (typeof window === "undefined") return "top";
  try {
    const stored = window.localStorage.getItem(READING_CHAPTER_KEY);
    return chapters.some((item) => item.id === stored) ? stored as BookChapterId : "top";
  } catch {
    return "top";
  }
}

function chapterTarget(documentElement: Document, id: BookChapterId) {
  if (id === "top") return documentElement.body;
  if (id === "contents") {
    return [...documentElement.querySelectorAll("h2")]
      .find((heading) => heading.textContent?.trim() === "Contents") ?? null;
  }
  return documentElement.getElementById(id);
}

function chapterAtPosition(documentElement: Document, readerWindow: Window): BookChapterId {
  // A short landscape reader may show little beyond the chapter heading and
  // its top margin. Use its midpoint instead of labelling that view as the
  // preceding chapter; taller readers retain the 160px reading threshold.
  const readingLine = readerWindow.scrollY + Math.min(160, readerWindow.innerHeight * .5);
  let active: BookChapterId = "top";
  for (const item of chapters.slice(1)) {
    const target = chapterTarget(documentElement, item.id);
    if (!target) continue;
    const top = target.getBoundingClientRect().top + readerWindow.scrollY;
    if (top > readingLine) break;
    active = item.id;
  }
  return active;
}

type BookReaderProps = {
  onClose: () => void;
  onOpenContext: () => void;
  initialChapter?: BookChapterId;
};

function focusableElements(container: HTMLElement | null) {
  return [...(container?.querySelectorAll<HTMLElement>(
    "button, select, iframe, [href], [tabindex]:not([tabindex='-1'])"
  ) ?? [])].filter((element) => !element.hasAttribute("disabled") && !element.closest("[inert]") && element.getClientRects().length > 0);
}

export function BookReader({ onClose, onOpenContext, initialChapter }: BookReaderProps) {
  const dialog = useRef<HTMLElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const readerCleanup = useRef<(() => void) | undefined>(undefined);
  const scrollPosition = useRef(0);
  const readingAnchor = useRef<ReadingAnchor | null>(null);
  const [ready, setReady] = useState(false);
  const [chapter, setChapter] = useState<BookChapterId>(() => initialChapter ?? savedChapter());
  const [fontScale, setFontScale] = useState(() => {
    try { return readingFontScale(window.localStorage.getItem(READING_SIZE_KEY)); }
    catch { return 1.05; }
  });

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = requestAnimationFrame(() => dialog.current?.focus());
    return () => {
      cancelAnimationFrame(focusFrame);
      readerCleanup.current?.();
      try {
        window.localStorage.setItem(READING_POSITION_KEY, String(Math.round(scrollPosition.current)));
        if (readingAnchor.current) window.localStorage.setItem(READING_ANCHOR_KEY, JSON.stringify(readingAnchor.current));
      } catch {
        // Reading still works when browser storage is unavailable.
      }
      const target = previousFocus.current;
      requestAnimationFrame(() => {
        restoreDialogFocus(target);
      });
    };
  }, []);

  useLayoutEffect(() => {
    const documentElement = frame.current?.contentDocument;
    const readerWindow = frame.current?.contentWindow;
    if (documentElement?.body && readerWindow) {
      const anchor = captureReadingAnchor(documentElement);
      documentElement.body.style.setProperty("--flatland-reader-font-size", `${fontScale}rem`);
      restoreReadingAnchor(documentElement, readerWindow, anchor);
      readingAnchor.current = captureReadingAnchor(documentElement);
      scrollPosition.current = readerWindow.scrollY;
    }
    try { window.localStorage.setItem(READING_SIZE_KEY, String(fontScale)); }
    catch { /* Reading works without persistent browser storage. */ }
  }, [fontScale]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
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

  const goToChapter = (id: BookChapterId) => {
    setChapter(id);
    try {
      window.localStorage.setItem(READING_CHAPTER_KEY, id);
    } catch {
      // Chapter navigation still works when browser storage is unavailable.
    }
    const documentElement = frame.current?.contentDocument;
    const readerWindow = frame.current?.contentWindow;
    if (!documentElement || !readerWindow) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
    if (id === "top") {
      readerWindow.scrollTo({ top: 0, behavior });
      return;
    }
    const target = chapterTarget(documentElement, id);
    target?.scrollIntoView({ behavior, block: "start" });
  };

  const prepareReader = () => {
    const documentElement = frame.current?.contentDocument;
    const readerWindow = frame.current?.contentWindow;
    if (!documentElement || !readerWindow) return;

    let style = documentElement.getElementById("flatland-reader-overrides") as HTMLStyleElement | null;
    if (!style) {
      style = documentElement.createElement("style");
      style.id = "flatland-reader-overrides";
      style.textContent = `
        :root {
          color-scheme: light;
          scroll-padding-top: 2rem;
          background: #c6b993;
        }
        html {
          scroll-behavior: smooth;
          background:
            radial-gradient(circle at 50% 0, rgba(255, 249, 229, .68), transparent 38rem),
            #c6b993 !important;
        }
        body {
          --flatland-reader-font-size: 1.05rem;
          width: auto !important;
          max-width: 50rem !important;
          min-height: 100vh;
          margin: 0 auto !important;
          padding: clamp(2rem, 6vw, 5rem) clamp(1.15rem, 6vw, 4.75rem) 8rem !important;
          color: #302b25 !important;
          background: #fffaf0 !important;
          box-shadow: 0 0 48px rgba(44, 35, 22, .26);
          font-family: Georgia, "Times New Roman", serif !important;
          font-size: var(--flatland-reader-font-size) !important;
          line-height: 1.72 !important;
          text-align: left !important;
        }
        #pg-header {
          display: block !important;
          margin: 0 0 3.5rem !important;
          padding: 1rem 1.1rem !important;
          border: 1px solid rgba(48, 43, 37, .22);
          border-radius: 3px;
          background: rgba(245, 236, 210, .42);
          font-family: system-ui, sans-serif;
          font-size: .78em;
          line-height: 1.5;
        }
        #pg-header h2 {
          margin: 0 0 .75rem !important;
          font: 700 1rem/1.35 system-ui, sans-serif !important;
        }
        #pg-header > div {
          margin: .7rem 0 !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
        }
        #pg-header #pg-machine-header {
          display: grid !important;
          grid-template-columns: 1fr 1fr;
          gap: .25rem 1rem;
          margin-top: .85rem !important;
          padding-top: .75rem !important;
          border-top: 1px solid rgba(48, 43, 37, .16) !important;
        }
        #pg-header #pg-machine-header > br { display: none !important; }
        #pg-header #pg-header-authlist { margin: 0 !important; }
        #pg-header p { margin: .45em 0 !important; text-indent: 0 !important; }
        #pg-header #pg-machine-header p { margin: 0 !important; font-size: .88em !important; }
        #pg-header #pg-start-separator {
          grid-column: 1 / -1;
          margin: 1rem 0 0 !important;
          padding-top: .75rem !important;
          border-top: 1px solid rgba(48, 43, 37, .16) !important;
        }
        #pg-footer {
          margin-top: 6rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(48, 43, 37, .22);
          font-family: system-ui, sans-serif;
          font-size: .78em;
          line-height: 1.5;
        }
        h1, h2, h3, h4, h5 {
          color: #573b27 !important;
          font-family: Georgia, "Times New Roman", serif !important;
          scroll-margin-top: 2rem;
        }
        h1 { font-size: clamp(2.2rem, 10vw, 4.5rem) !important; }
        h2 { margin-top: 3.5rem !important; font-size: clamp(1.35rem, 5vw, 2rem) !important; }
        p {
          margin: .55em 0 !important;
          text-indent: 1.35em;
          text-wrap: pretty;
        }
        p.center, p.noindent, .fig p, #pg-header p, #pg-footer p { text-indent: 0 !important; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: .28rem .15rem; line-height: 1.35; }
        a:link, a:visited { color: #315d57 !important; text-decoration-color: rgba(49, 93, 87, .4) !important; }
        a:hover { color: #8b5f2e !important; }
        img { max-width: 100% !important; height: auto !important; }
        div.fig { margin: 2rem auto !important; }
        @media (max-width: 640px) {
          body {
            padding: 2rem 1.15rem 6rem !important;
            line-height: 1.64 !important;
          }
          div.chapter { margin-top: 2.5rem !important; }
          h2 { margin-top: 2.5rem !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto !important; }
        }
      `;
      documentElement.head.append(style);
    }
    documentElement.body.style.setProperty("--flatland-reader-font-size", `${fontScale}rem`);

    readerCleanup.current?.();
    const handleReaderKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    let chapterFrame = 0;
    let activeChapter = chapter;
    let readerWidth = readerWindow.innerWidth;
    let readerHeight = readerWindow.innerHeight;
    const rememberChapter = () => {
      readerWindow.cancelAnimationFrame(chapterFrame);
      chapterFrame = readerWindow.requestAnimationFrame(() => {
        // A narrower/shorter viewport may clamp the old pixel scroll offset
        // before its resize event runs. Keep the previous text anchor until
        // that event restores it; otherwise we would save the clamped ending.
        if (readerWindow.innerWidth !== readerWidth || readerWindow.innerHeight !== readerHeight) return;
        readingAnchor.current = captureReadingAnchor(documentElement);
        const nextChapter = chapterAtPosition(documentElement, readerWindow);
        if (nextChapter === activeChapter) return;
        activeChapter = nextChapter;
        setChapter(nextChapter);
        try {
          window.localStorage.setItem(READING_CHAPTER_KEY, nextChapter);
        } catch {
          // Reading position tracking does not depend on browser storage.
        }
      });
    };
    const rememberPosition = () => {
      scrollPosition.current = readerWindow.scrollY;
      rememberChapter();
    };
    const preserveViewportPosition = () => {
      readerWidth = readerWindow.innerWidth;
      readerHeight = readerWindow.innerHeight;
      restoreReadingAnchor(documentElement, readerWindow, readingAnchor.current);
      scrollPosition.current = readerWindow.scrollY;
      rememberChapter();
    };
    documentElement.addEventListener("keydown", handleReaderKey);
    readerWindow.addEventListener("scroll", rememberPosition, { passive: true });
    readerWindow.addEventListener("resize", preserveViewportPosition);
    readerCleanup.current = () => {
      documentElement.removeEventListener("keydown", handleReaderKey);
      readerWindow.removeEventListener("scroll", rememberPosition);
      readerWindow.removeEventListener("resize", preserveViewportPosition);
      readerWindow.cancelAnimationFrame(chapterFrame);
    };

    if (initialChapter) {
      try {
        window.localStorage.setItem(READING_CHAPTER_KEY, initialChapter);
      } catch {
        // Direct chapter navigation still works when browser storage is unavailable.
      }
      requestAnimationFrame(() => {
        const target = chapterTarget(documentElement, initialChapter);
        target?.scrollIntoView({ block: "start", behavior: "instant" });
        scrollPosition.current = readerWindow.scrollY;
        rememberChapter();
      });
      setReady(true);
      return;
    }

    try {
      const savedPosition = Number(window.localStorage.getItem(READING_POSITION_KEY));
      let savedAnchor: unknown = null;
      try { savedAnchor = JSON.parse(window.localStorage.getItem(READING_ANCHOR_KEY) ?? "null"); }
      catch { /* Fall back to the legacy pixel bookmark. */ }
      if (savedAnchor || (Number.isFinite(savedPosition) && savedPosition > 0)) {
        requestAnimationFrame(() => {
          if (!restoreReadingAnchor(documentElement, readerWindow, savedAnchor)) {
            readerWindow.scrollTo({ top: Number.isFinite(savedPosition) ? Math.max(0, savedPosition) : 0, behavior: "instant" });
          }
          scrollPosition.current = readerWindow.scrollY;
          rememberChapter();
        });
      } else {
        rememberChapter();
      }
    } catch {
      // Start at the cover when browser storage is unavailable.
      rememberChapter();
    }
    setReady(true);
  };

  return (
    <div className="book-reader-scrim" role="presentation" onPointerDown={closeFromScrim}>
      <section
        id="flatland-book-reader"
        ref={dialog}
        className="book-reader parchment-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-reader-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="book-reader__toolbar">
          <div className="book-reader__identity">
            <BookOpenText aria-hidden="true" />
            <div>
              <p className="eyebrow">The complete illustrated book</p>
              <h2 id="book-reader-title">Flatland</h2>
              <p>Project Gutenberg ebook 97 · public domain in the USA</p>
            </div>
          </div>

          <div className="book-reader__controls">
            <label>
              <span>Go to</span>
              <select
                aria-label="Go to a chapter"
                value={chapter}
                onChange={(event) => goToChapter(event.target.value as BookChapterId)}
              >
                {chapters.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <div className="book-reader__zoom" role="group" aria-label="Reading text size">
              <button
                type="button"
                aria-label="Make reading text smaller"
                disabled={fontScale <= .9}
                onClick={() => setFontScale((size) => Math.max(.9, Number((size - .1).toFixed(2))))}
              >
                <Minus aria-hidden="true" />
              </button>
              <span aria-live="polite">{Math.round(fontScale * 100)}%</span>
              <button
                type="button"
                aria-label="Make reading text larger"
                disabled={fontScale >= 1.4}
                onClick={() => setFontScale((size) => Math.min(1.4, Number((size + .1).toFixed(2))))}
              >
                <Plus aria-hidden="true" />
              </button>
            </div>
            <a
              className="book-reader__source"
              href={BOOK_SOURCE_PAGE}
              target="_blank"
              rel="noreferrer"
              title="View Project Gutenberg ebook 97"
            >
              Source <ExternalLink aria-hidden="true" />
            </a>
            <button type="button" className="book-reader__close" aria-label="Close the book" onClick={onClose}>
              <X aria-hidden="true" />
            </button>
          </div>
        </header>

        <aside className="book-reader__gutenberg-notice" aria-label="Project Gutenberg terms">
          <p>
            <strong>Project Gutenberg notice.</strong>{" "}
            This eBook is for the use of anyone anywhere in the United States and most other parts of the world at no cost and with almost no restrictions whatsoever.
            You may copy it, give it away or re-use it under the terms of the <a href={BOOK_LICENSE_PAGE} target="_blank" rel="noreferrer">Project Gutenberg License</a> included with this eBook or online at <a href="https://www.gutenberg.org" target="_blank" rel="noreferrer">www.gutenberg.org</a>.
            If you are not located in the United States, you will have to check the laws of the country where you are located before using this eBook.
          </p>
        </aside>

        <aside className="book-reader__adaptation-note" aria-label="About this project">
          <div>
            <Info aria-hidden="true" />
            <p><strong>Simulation note.</strong> The playable idea is 2D-to-3D; 4D is an analogy.</p>
          </div>
          <button type="button" onClick={onOpenContext}>About the project <ArrowRight aria-hidden="true" /></button>
        </aside>

        <div className="book-reader__page">
          {!ready && <p className="book-reader__loading" role="status">Opening the illustrated edition…</p>}
          <iframe
            ref={frame}
            className={ready ? "is-ready" : ""}
            src={BOOK_SOURCE}
            title="Flatland: A Romance of Many Dimensions — full text"
            onLoad={prepareReader}
          />
        </div>
      </section>
    </div>
  );
}
