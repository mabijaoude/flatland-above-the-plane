import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const allowedLicenses = new Set([
  "Apache-2.0",
  "BSD-3-Clause",
  "ISC",
  "MIT",
  "OFL-1.1"
]);

const pnpmCli = process.env.npm_execpath;
const pnpmCliIsJavaScript = pnpmCli ? /\.(?:c|m)?js$/i.test(pnpmCli) : false;
let command;
let args;

if (pnpmCliIsJavaScript) {
  command = process.execPath;
  args = [pnpmCli, "licenses", "list", "--prod", "--json"];
} else if (pnpmCli) {
  command = pnpmCli;
  args = ["licenses", "list", "--prod", "--json"];
} else if (process.platform === "win32") {
  command = process.env.ComSpec || "cmd.exe";
  args = ["/d", "/s", "/c", "pnpm.cmd licenses list --prod --json"];
} else {
  command = "pnpm";
  args = ["licenses", "list", "--prod", "--json"];
}
const result = spawnSync(command, args, { encoding: "utf8" });

if (result.status !== 0) {
  process.stderr.write(result.stderr || "Could not read the production dependency licenses.\n");
  process.exit(result.status ?? 1);
}

const report = JSON.parse(result.stdout);
const unexpected = Object.keys(report).filter((license) => !allowedLicenses.has(license));
if (unexpected.length) {
  throw new Error(`Review newly introduced dependency licenses: ${unexpected.join(", ")}`);
}

const notice = readFileSync(new URL("../public/THIRD_PARTY_NOTICES.txt", import.meta.url), "utf8");
const missing = [];
let packageEntries = 0;

for (const entries of Object.values(report)) {
  for (const entry of entries) {
    packageEntries += 1;
    const inventoryLine = `${entry.name}@${entry.versions.join(", ")}`;
    if (!notice.includes(inventoryLine)) missing.push(inventoryLine);
  }
}

if (missing.length) {
  throw new Error(`THIRD_PARTY_NOTICES.txt is stale. Add or update: ${missing.join(", ")}`);
}

process.stdout.write(`Checked ${packageEntries} production dependency entries across ${Object.keys(report).length} allowed license families.\n`);
