import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BookReader } from "./BookReader";

describe("BookReader", () => {
  it("presents the complete local illustrated edition as an accessible dialog", () => {
    const html = renderToStaticMarkup(<BookReader onClose={vi.fn()} onOpenContext={vi.fn()} />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("The complete illustrated book");
    expect(html).toContain('src="/books/flatland/index.html"');
    expect(html).toContain("Project Gutenberg ebook 97");
    expect(html).toContain('aria-label="Project Gutenberg terms"');
    expect(html).toContain("Project Gutenberg License");
    expect(html).toContain("Go to a chapter");
    expect(html).toContain("The playable idea is 2D-to-3D; 4D is an analogy");
    expect(html).toContain("About the project");
  });

  it("can open directly to a source chapter from the project context", () => {
    const html = renderToStaticMarkup(
      <BookReader onClose={vi.fn()} onOpenContext={vi.fn()} initialChapter="chap17" />
    );

    expect(html).toContain('<option value="chap17" selected="">17');
  });
});
