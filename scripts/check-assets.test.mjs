import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkAssets } from "./check-assets.mjs";

const directories = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "flatland-assets-test-"));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe("public asset verification", () => {
  it("checks nested assets and accepts a PNG signature", () => {
    const directory = fixture();
    mkdirSync(join(directory, "materials"));
    writeFileSync(join(directory, "materials", "test.png"), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    writeFileSync(join(directory, "notice.txt"), "A notice");
    expect(checkAssets(directory)).toBe(2);
  });
  it("rejects Git LFS pointers regardless of the file extension", () => {
    const directory = fixture();
    writeFileSync(join(directory, "model.glb"), "version https://git-lfs.github.com/spec/v1\noid sha256:example\nsize 100");
    expect(() => checkAssets(directory)).toThrow("git lfs pull");
  });
  it("rejects missing or incorrect PNG signatures", () => {
    const directory = fixture();
    writeFileSync(join(directory, "test.png"), "not an image");
    expect(() => checkAssets(directory)).toThrow("Invalid PNG header");
  });
});
