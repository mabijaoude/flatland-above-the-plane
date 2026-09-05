import { closeSync, openSync, readdirSync, readSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function checkAssets(directory) {
  let count = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      count += checkAssets(path);
      continue;
    }
    if (!entry.isFile()) throw new Error(`Unexpected non-file in public assets: ${path}`);
    const descriptor = openSync(path, "r");
    const header = Buffer.alloc(128);
    let bytes;
    try {
      bytes = readSync(descriptor, header, 0, header.length, 0);
    } finally {
      closeSync(descriptor);
    }
    if (header.toString("utf8", 0, bytes).startsWith("version https://git-lfs.github.com/spec/v1")) {
      throw new Error(`Unresolved Git LFS pointer: ${path}. Install Git LFS and run git lfs pull before building.`);
    }
    if (/\.png$/i.test(entry.name) && (bytes < 8 || !header.subarray(0, 8).equals(pngSignature))) {
      throw new Error(`Invalid PNG header: ${path}`);
    }
    count += 1;
  }
  return count;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const count = checkAssets(fileURLToPath(new URL("../public/", import.meta.url)));
  process.stdout.write(`Checked ${count} public assets: no LFS pointers or invalid PNG headers.\n`);
}
