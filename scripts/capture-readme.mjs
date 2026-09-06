// Capture the real application in fresh, disposable browser contexts.
// No user profile, saved town, credentials, or browser chrome is captured.
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.SCREENSHOT_BASE_URL;
if (!baseURL || !/^https?:\/\//.test(baseURL)) {
  throw new Error("Set SCREENSHOT_BASE_URL to an already running development application. This script does not start a server.");
}
const output = fileURLToPath(new URL("../docs/images/", import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined
});
const errors = [];
async function visit(viewport = { width: 1600, height: 1000 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(baseURL);
  await page.getByRole("button", { name: "Explore freely", exact: true }).click();
  await expect(page.getByRole("heading", { name: "See Flatland from above." })).not.toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function townMenu(page) {
  await page.getByRole("button", { name: "Open town controls", exact: true }).click();
}
async function overview(page) {
  await townMenu(page);
  await page.getByRole("button", { name: "Pause town Hold routines", exact: true }).click();
  await page.getByRole("combobox", { name: /Visual detail/ }).selectOption("cinematic");
  await page.getByRole("button", { name: "Frame town Overview", exact: true }).click();
  await page.keyboard.press("o");
}
async function capture(page, name) {
  for (const label of ["Dismiss message", "Dismiss exploration suggestion"]) {
    const dismiss = page.getByRole("button", { name: label, exact: true });
    if (await dismiss.isVisible()) await dismiss.click();
  }
  // Allow camera damping and the GPU frame to settle after the UI action.
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${output}/${name}.jpg`, type: "jpeg", quality: 88, animations: "disabled" });
  process.stdout.write(`Captured ${name}.jpg\n`);
}
try {
  const town = await visit();
  await overview(town);
  await capture(town, "town-overview");

  await town.getByRole("button", { name: "About the project and its source", exact: true }).click();
  await capture(town, "source-and-context");
  await town.getByRole("button", { name: "Close source and context notes", exact: true }).click();
  await town.getByRole("button", { name: "Read Flatland", exact: true }).click();
  await expect(town.locator("iframe")).toHaveClass("is-ready");
  await town.getByRole("combobox", { name: "Go to a chapter", exact: true }).selectOption("chap17");
  await capture(town, "illustrated-book");

  const carry = await visit();
  await carry.keyboard.press("Control+k");
  await carry.getByRole("searchbox", { name: "Find a citizen", exact: true }).fill("Soren Abbott");
  await carry.getByRole("button", { name: "Pick up Soren Abbott", exact: true }).click();
  await expect(carry.getByText("Soren Abbott is in hand.", { exact: true })).toBeVisible();
  await capture(carry, "dimensional-lift");

  const native = await visit();
  await townMenu(native);
  await native.getByRole("button", { name: "Guided visit Replay the tour", exact: true }).click();
  for (const name of ["Frame the town", "Choose Soren Abbott", "Follow Soren Abbott", "Enter native vision"]) {
    await native.getByRole("button", { name, exact: true }).click();
  }
  await expect(native.getByRole("region", { name: "Strict native vision", exact: true })).toBeVisible();
  await capture(native, "native-vision");

  const social = await visit({ width: 1200, height: 630 });
  await overview(social);
  for (const label of ["Dismiss message", "Dismiss exploration suggestion"]) {
    const dismiss = social.getByRole("button", { name: label, exact: true });
    if (await dismiss.isVisible()) await dismiss.click();
  }
  await social.waitForTimeout(1400);
  await social.screenshot({
    path: fileURLToPath(new URL("../public/social-preview.jpg", import.meta.url)),
    type: "jpeg", quality: 90, animations: "disabled"
  });
  process.stdout.write("Captured public/social-preview.jpg\n");
  if (errors.length) throw new Error(`Application errors during capture: ${errors.join("; ")}`);
} finally {
  await browser.close();
}
