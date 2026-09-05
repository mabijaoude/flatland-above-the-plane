import { expect, test, type Page } from "@playwright/test";

async function explore(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore freely", exact: true }).click();
  await expect(page.getByRole("heading", { name: "See Flatland from above." })).not.toBeVisible();
}

test("welcome contains keyboard focus and the full book opens directly", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Take the 90-second tour" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Flatland", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Take the 90-second tour" })).toBeFocused();
  await page.getByRole("button", { name: "Flatland", exact: true }).click();
  const book = page.frameLocator("iframe");
  await expect(book.locator("#pg-header")).toBeVisible();
  await expect(book.locator("#pg-footer")).toBeAttached();
  await expect.poll(() => book.locator("img").evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
});

test("book text resizing and reopening preserve the passage and size", async ({ page }) => {
  await explore(page);
  await page.getByRole("button", { name: "Read Flatland", exact: true }).click();
  await expect(page.locator("iframe")).toHaveClass("is-ready");
  await page.getByRole("combobox", { name: "Go to a chapter" }).selectOption("chap17");
  const heading = page.frameLocator("iframe").getByRole("heading", { name: /17 How the Sphere/ });
  await expect.poll(async () => (await heading.boundingBox())!.y).toBeLessThan(400);
  const before = (await heading.boundingBox())!.y;
  await page.getByRole("button", { name: "Make reading text larger" }).click();
  await expect(page.getByText("115%", { exact: true })).toBeVisible();
  await expect.poll(async () => Math.abs((await heading.boundingBox())!.y - before)).toBeLessThan(5);
  await page.getByRole("button", { name: "Close the book" }).click();
  await page.getByRole("button", { name: "Read Flatland", exact: true }).click();
  await expect(page.locator("iframe")).toHaveClass("is-ready");
  await expect(page.getByText("115%", { exact: true })).toBeVisible();
  await expect.poll(async () => Math.abs((await heading.boundingBox())!.y - before)).toBeLessThan(5);
});

test("clearing an empty citizen search returns focus to search", async ({ page }) => {
  await explore(page);
  // Begin outside the dismissed welcome dialog, even on a slow renderer.
  await page.getByRole("button", { name: "Read Flatland", exact: true }).focus();
  await page.keyboard.press("Control+k");
  const search = page.getByRole("searchbox", { name: "Find a citizen" });
  await search.fill("no-matching-citizen");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(search).toBeFocused();
  await search.fill("teacher");
  await expect(page.getByRole("heading", { name: "Iris Judd", exact: true })).toBeVisible();
});

test("guided visit completes and undoes its wall change without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Take the 90-second tour" }).click();
  for (const name of ["Frame the town", "Choose Soren Abbott", "Follow Soren Abbott", "Enter native vision", "Return above", "Open the boundary", "Undo the change"]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await expect(page.getByText("Guided visit complete.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Explore freely", exact: true }).click();
  expect(errors).toEqual([]);
});

test("source-to-book navigation restores a useful focus target", async ({ page }) => {
  await explore(page);
  await page.getByRole("button", { name: "About the project and its source" }).click();
  await page.getByRole("button", { name: "Read section 19", exact: true }).click();
  await expect(page.locator("iframe")).toHaveClass("is-ready");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Read Flatland", exact: true })).toBeFocused();
});

test("a failed application download offers recovery and the book", async ({ page }) => {
  await page.route(/\/assets\/index-[^/]+\.js$/, route => route.abort());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Flatland could not start." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload Flatland" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read Flatland", exact: true })).toHaveAttribute("href", "/books/flatland/index.html");
});

test("the production artifact contains actual textures and license notices", async ({ request }) => {
  const image = await request.get("/assets/materials/parchment.png");
  expect(image.ok()).toBe(true);
  expect([...(await image.body()).subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  for (const path of ["/PROJECT_LICENSE.txt", "/THIRD_PARTY_NOTICES.txt", "/favicon.svg"]) {
    expect((await request.get(path)).ok()).toBe(true);
  }
});

test.describe("phone-sized reading", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  test("rotating the viewport preserves the current passage", async ({ page }) => {
    await explore(page);
    await page.getByRole("button", { name: "Read Flatland", exact: true }).tap();
    await expect(page.locator("iframe")).toHaveClass("is-ready");
    await page.getByRole("button", { name: "Make reading text larger" }).tap();
    await page.getByRole("button", { name: "Make reading text larger" }).tap();
    await page.getByRole("combobox", { name: "Go to a chapter" }).selectOption("chap17");
    const heading = page.frameLocator("iframe").getByRole("heading", { name: /17 How the Sphere/ });
    const passageVisible = () => heading.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    });
    await expect.poll(passageVisible).toBe(true);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(passageVisible).toBe(true);
    await expect(page.getByRole("combobox", { name: "Go to a chapter" })).toHaveValue("chap17");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(passageVisible).toBe(true);
  });
  test("text controls remain visible and chapter jumps respect reduced motion", async ({ page }) => {
    await explore(page);
    await page.getByRole("button", { name: "Read Flatland", exact: true }).tap();
    await expect(page.locator("iframe")).toHaveClass("is-ready");
    await page.getByRole("button", { name: "Make reading text larger" }).tap();
    await expect(page.getByText("115%", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Go to a chapter" }).selectOption("chap19");
    expect(await page.frameLocator("iframe").locator("html").evaluate(element => getComputedStyle(element).scrollBehavior)).toBe("auto");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Close the book" }).tap();
    await expect(page.getByRole("button", { name: "Open town controls" })).toBeVisible();
  });
});
