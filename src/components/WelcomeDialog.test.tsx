import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WelcomeDialog } from "./WelcomeDialog";

function renderWelcome(hasSavedTown = false) {
  return renderToStaticMarkup(
    <WelcomeDialog
      hasSavedTown={hasSavedTown}
      onContinue={vi.fn()}
      onStartNewTown={vi.fn()}
      onStartGuidedTour={vi.fn()}
      onReadBook={vi.fn()}
      onOpenAnalogy={vi.fn()}
    />
  );
}

describe("WelcomeDialog", () => {
  it("keeps exploration and the guided tour primary while linking the book and analogy in context", () => {
    const html = renderWelcome();

    expect(html).toContain("See Flatland from above.");
    expect(html).toContain("takes inspiration from Edwin A. Abbott");
    expect(html).toContain("Read more about this analogy");
    expect(html).toContain("Explore freely");
    expect(html).toContain("Take the 90-second tour");
    expect(html).not.toContain("Read the complete book");
    expect(html).not.toContain("adaptation");
    expect(html.indexOf("Explore freely")).toBeLessThan(html.indexOf("Take the 90-second tour"));
  });

  it("offers a saved visitor a direct continuation and an unobtrusive fresh start", () => {
    const html = renderWelcome(true);

    expect(html).toContain("Continue saved town");
    expect(html).toContain("Take the 90-second tour");
    expect(html).toContain("Start a new town");
  });
});
