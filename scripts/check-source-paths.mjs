import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Text-only secret scans do not inspect Blender's stored workspace directories.
// These optional source files are intentionally uncompressed for this check.
export function checkSourcePaths(directory) {
  let count = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) count += checkSourcePaths(path);
    else if (/\.blend$/i.test(entry.name)) {
      if (!entry.isFile()) throw new Error(`Unexpected non-file Blender source: ${path}`);
      const bytes = readFileSync(path);
      if (bytes.subarray(0, 7).toString("ascii") !== "BLENDER") {
        throw new Error(`Inspect ${path}: fetch its LFS content and save it without compression before checking source metadata.`);
      }
      if (/(?:[A-Z]:[\\/]Users[\\/]|\/(?:Users|home)\/|192\.168\.|\/volume1\/docker)/i.test(bytes.toString("latin1"))) {
        throw new Error(`Local-path metadata found in ${path}. Inspect and sanitize the Blender workspace before committing; do not print private paths in logs.`);
      }
      count += 1;
    }
  }
  return count;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const count = checkSourcePaths(fileURLToPath(new URL("../art_source/", import.meta.url)));
  process.stdout.write(`Checked ${count} Blender sources for embedded home-directory and deployment paths.\n`);
}
