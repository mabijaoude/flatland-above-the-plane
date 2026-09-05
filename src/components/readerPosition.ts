const READING_BLOCKS = "h1, h2, h3, h4, p, table, div.fig";

export type ReadingAnchor = { index: number; topRatio: number };

// A text block survives font-size and viewport changes; a document pixel offset
// does not. Keep the first visible block at the same relative reading position.
export function captureReadingAnchor(documentElement: Document): ReadingAnchor | null {
  const blocks = documentElement.querySelectorAll<HTMLElement>(READING_BLOCKS);
  for (let index = 0; index < blocks.length; index += 1) {
    const rect = blocks[index].getBoundingClientRect();
    if (rect.height > 0 && rect.bottom > 0) return { index, topRatio: rect.top / rect.height };
  }
  return null;
}

export function restoreReadingAnchor(documentElement: Document, readerWindow: Window, value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const { index, topRatio } = value as Partial<ReadingAnchor>;
  if (!Number.isInteger(index) || index! < 0 || typeof topRatio !== "number" || !Number.isFinite(topRatio)) return false;
  const block = documentElement.querySelectorAll<HTMLElement>(READING_BLOCKS)[index!];
  if (!block) return false;
  const rect = block.getBoundingClientRect();
  if (rect.height <= 0) return false;
  readerWindow.scrollTo({ top: readerWindow.scrollY + rect.top - rect.height * topRatio, behavior: "instant" });
  return true;
}

export function readingFontScale(value: string | null): number {
  const size = Number(value);
  return Number.isFinite(size) && size >= .9 && size <= 1.4 ? size : 1.05;
}
