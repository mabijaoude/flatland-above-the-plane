import { describe, expect, it, vi } from "vitest";
import { captureReadingAnchor, readingFontScale, restoreReadingAnchor } from "./readerPosition";

function readerDocument(rects: Array<{ top: number; height: number }>) {
  return { querySelectorAll: () => rects.map(({ top, height }) => ({
    getBoundingClientRect: () => ({ top, height, bottom: top + height })
  })) } as unknown as Document;
}

describe("reader position", () => {
  it("anchors the first visible text block instead of its document offset", () => {
    expect(captureReadingAnchor(readerDocument([{ top: -200, height: 100 }, { top: -20, height: 80 }]))).toEqual({ index: 1, topRatio: -.25 });
  });
  it("preserves the visible part of a paragraph after text reflows", () => {
    const scrollTo = vi.fn();
    const readerWindow = { scrollY: 5000, scrollTo } as unknown as Window;
    expect(restoreReadingAnchor(readerDocument([{ top: 700, height: 160 }]), readerWindow, { index: 0, topRatio: -.25 })).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 5740, behavior: "instant" });
  });
  it("ignores unavailable or malformed saved anchors", () => {
    const doc = readerDocument([]);
    for (const value of [null, {}, { index: -1, topRatio: 0 }, { index: 1, topRatio: Infinity }, { index: 9, topRatio: 0 }]) {
      expect(restoreReadingAnchor(doc, {} as Window, value)).toBe(false);
    }
  });
  it("restores a supported font size and rejects invalid browser storage", () => {
    expect(readingFontScale("1.25")).toBe(1.25);
    for (const value of [null, "", "not-a-size", "Infinity", "9", "0.1"]) expect(readingFontScale(value)).toBe(1.05);
  });
});
