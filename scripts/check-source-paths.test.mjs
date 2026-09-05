import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkSourcePaths } from "./check-source-paths.mjs";

const directories = [];
function fixture(contents) {
  const directory = mkdtempSync(join(tmpdir(), "flatland-source-test-"));
  directories.push(directory);
  writeFileSync(join(directory, "source.blend"), contents);
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe("Blender metadata privacy guard", () => {
  it("accepts relative workspace paths", () => {
    expect(checkSourcePaths(fixture("BLENDER-v405\0//textures/\0"))).toBe(1);
  });
  it.each(["C:\\Users\\Example\\Documents", "/Users/example/Documents", "/home/example/projects"])(
    "rejects embedded home-directory metadata without echoing it", path => {
      const directory = fixture(`BLENDER-v405\0${path}\0`);
      expect(() => checkSourcePaths(directory)).toThrow("Local-path metadata found");
      try { checkSourcePaths(directory); } catch (error) { expect(error.message).not.toContain(path); }
    }
  );
  it("requires materialized, uncompressed source data", () => {
    expect(() => checkSourcePaths(fixture("version https://git-lfs.github.com/spec/v1"))).toThrow("save it without compression");
  });
});
