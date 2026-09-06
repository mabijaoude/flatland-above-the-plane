import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const requiredFiles = [
  "LICENSE",
  "README.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.md",
  "docs/RIGHTS.md",
  "docs/SOURCE_AND_CONTEXT.md",
  "public/PROJECT_LICENSE.txt",
  "public/THIRD_PARTY_NOTICES.txt",
  "public/licenses/Apache-2.0.txt",
  "public/licenses/BSD-3-Clause.txt",
  "public/licenses/ISC.txt",
  "public/licenses/MIT.txt",
  "public/licenses/OFL-1.1.txt"
];

const missingFiles = requiredFiles.filter((path) => !existsSync(new URL(path, root)));
if (missingFiles.length) throw new Error(`Missing public-release files: ${missingFiles.join(", ")}`);

const packageJson = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
if (packageJson.license !== "MIT") throw new Error("package.json must declare the project's MIT license.");
if (!packageJson.engines?.node) throw new Error("package.json must declare the supported Node.js version.");

const projectLicense = readFileSync(new URL("LICENSE", root), "utf8").replace(/\r\n/g, "\n").trimEnd();
const bundledProjectLicense = readFileSync(new URL("public/PROJECT_LICENSE.txt", root), "utf8").replace(/\r\n/g, "\n").trimEnd();
if (projectLicense !== bundledProjectLicense) throw new Error("The project license copied into the built artifact is stale.");

const readme = readFileSync(new URL("README.md", root), "utf8");
// README images use ordinary Git JPEGs so GitHub can render them without LFS.
const readmeLinks = [...readme.matchAll(/\[[^\]\n]*\]\(([^)\s]+)\)/g)].map(match => match[1]);
for (const href of readmeLinks) {
  if (/^(?:https?:|mailto:|#)/i.test(href)) continue;
  const path = decodeURIComponent(href.split("#")[0]);
  if (!existsSync(new URL(path, root))) throw new Error(`README link points to a missing file: ${path}`);
}
const screenshotPaths = [...new Set(readmeLinks.filter(href => /^docs\/images\/.*\.jpg$/.test(href)))];
if (screenshotPaths.length < 5) throw new Error("The README must include the five reviewed application screenshots.");
for (const path of [...screenshotPaths, "public/social-preview.jpg"]) {
  const bytes = readFileSync(new URL(path, root));
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new Error(`Invalid JPEG or unmaterialized asset pointer: ${path}`);
  }
  if (bytes.length > 600_000) throw new Error(`Compress the release screenshot before publishing: ${path}`);
}
const indexHtml = readFileSync(new URL("index.html", root), "utf8");
for (const marker of ['property="og:image"', 'name="twitter:card" content="summary_large_image"', '/social-preview.jpg']) {
  if (!indexHtml.includes(marker)) throw new Error(`The website sharing preview is missing: ${marker}`);
}
const privateReference = /(?:\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\b192\.168\.\d{1,3}\.\d{1,3}\b|\b172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b|ForeverStorage\.local|\/volume1\/docker)/i;
if (privateReference.test(readme)) throw new Error("README.md contains a private-network or deployment-only reference.");

const book = readFileSync(new URL("public/books/flatland/index.html", root), "utf8");
for (const marker of [
  'id="pg-header"',
  'id="pg-footer"',
  "START OF THE PROJECT GUTENBERG EBOOK",
  'id="project-gutenberg-license"',
  "START: FULL LICENSE"
]) {
  if (!book.includes(marker)) throw new Error(`The bundled Gutenberg edition is missing: ${marker}`);
}

const reader = readFileSync(new URL("src/components/BookReader.tsx", root), "utf8");
if (/#pg-header\s*\{[^}]*display\s*:\s*none/is.test(reader)) {
  throw new Error("The reader must not hide the Project Gutenberg header.");
}
for (const marker of ["Project Gutenberg terms", "Project Gutenberg License", "https://www.gutenberg.org/policy/license.html"]) {
  if (!reader.includes(marker)) throw new Error(`The persistent Gutenberg reader notice is missing: ${marker}`);
}

const source = JSON.parse(readFileSync(new URL("public/books/flatland/source.json", root), "utf8"));
if (source.source !== "https://www.gutenberg.org/ebooks/97") throw new Error("The ebook source record is missing or unexpected.");
if (!/public domain in the USA/i.test(source.rights)) throw new Error("The ebook source record must state its territorial public-domain claim precisely.");

process.stdout.write(`Release checks passed for ${requiredFiles.length} required files and the bundled Gutenberg edition.\n`);
