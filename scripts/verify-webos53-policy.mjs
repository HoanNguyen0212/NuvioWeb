import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compatibilityPolicy } from "./compatibilityPolicy.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function read(relativePath) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

async function assertFile(relativePath) {
  try {
    await access(path.join(rootDir, relativePath));
  } catch {
    throw new Error(`Required Chromium 53 asset is missing: ${relativePath}`);
  }
}

assert(
  compatibilityPolicy.webOsRequiredVersion === "4.0.0",
  `webOS requirement changed to ${compatibilityPolicy.webOsRequiredVersion}`
);
assert(
  compatibilityPolicy.chromiumVersion === 53,
  `Browser build target changed to Chrome ${compatibilityPolicy.chromiumVersion}`
);
assert(
  compatibilityPolicy.webOsChromiumVersion === 53,
  `webOS compatibility gate changed to Chrome ${compatibilityPolicy.webOsChromiumVersion}`
);

const requiredAssets = [
  "nuvio-legacy-polyfills.js",
  "nuvio-legacy-fast-home.js",
  "css/nuvio-legacy-performance.css",
  "scripts/analyze-legacy-bundle.mjs",
  "scripts/create-placeholder-properties.mjs",
  "scripts/verify-legacy-webos-package.mjs"
];
await Promise.all(requiredAssets.map(assertFile));

const [buildSource, packageSource, packageJsonSource] = await Promise.all([
  read("scripts/build.mjs"),
  read("scripts/package-webos.mjs"),
  read("package.json")
]);
const packageJson = JSON.parse(packageJsonSource);

assert(buildSource.includes("test: /\\.js$/"), "Legacy transpilation no longer covers every JS chunk");
assert(
  buildSource.includes("target: `chrome${compatibilityPolicy.chromiumVersion}`"),
  "Legacy bundle no longer derives its browser target from compatibilityPolicy"
);
for (const include of [
  'src="nuvio-legacy-polyfills.js"',
  'src="nuvio-legacy-fast-home.js"',
  'href="css/nuvio-legacy-performance.css"'
]) {
  assert(packageSource.includes(include), `webOS package template lost required include: ${include}`);
}
assert(packageJson.scripts?.["package:webos"], "package:webos script is missing");
assert(packageJson.scripts?.test, "test script is missing");

console.log(
  JSON.stringify({
    status: "ok",
    webOsRequiredVersion: compatibilityPolicy.webOsRequiredVersion,
    chromiumVersion: compatibilityPolicy.chromiumVersion,
    requiredAssets: requiredAssets.length
  })
);
