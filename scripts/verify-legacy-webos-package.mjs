import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";
import { parseProperties } from "./envProperties.mjs";
import { readAppMetadata } from "./appMetadata.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(rootDir, ".cache", "webos-package", "app");
const reportDir = path.join(rootDir, ".cache", "legacy-package-verification");
const placeholderRuntimeValue = "__NUVIO_PRIVATE_RUNTIME_VALUE__";
const sensitiveRuntimeKeys = [
  "NUVIO_SUPABASE_URL",
  "NUVIO_SUPABASE_ANON_KEY",
  "TV_LOGIN_WEB_BASE_URL",
  "YOUTUBE_PROXY_URL",
  "PARENTAL_GUIDE_API_URL",
  "INTRODB_API_URL",
  "IMDB_RATINGS_API_BASE_URL",
  "AVATAR_PUBLIC_BASE_URL",
  "UNIQUE_CONTRIBUTIONS_BASE_URL",
  "DONATIONS_BASE_URL",
  "DONATIONS_DONATE_URL",
  "TMDB_API_KEY",
  "TRAKT_CLIENT_ID",
  "TRAKT_CLIENT_SECRET",
  "TRAKT_API_URL",
  "TRAKT_REDIRECT_URI"
];
const overlayHashes = {
  "nuvio-legacy-fast-home.js": "ed7d432edead2db98fbd45d2090be30618e86f3ccb79f00e8bce9edad00ab380",
  "nuvio-legacy-polyfills.js": "e04badf84cf5b286d318cb0219da0eb17c5aa1932856ed002db575fd3d1505c2",
  "css/nuvio-legacy-performance.css": "7e7dd876678e996c5e2364c7e15cd2853f75975698955764ae5e60b8f69be701"
};
const stagedOverlayHashes = {
  "nuvio-legacy-fast-home.js": "045e4903abda3099bfdb1f9e22c6b4b237fde69e3719b8893c2712431a090409",
  "nuvio-legacy-polyfills.js": "8b0f4471be7ef861ae40d699505493ec5e3a493fb8637e679d1b824b9c5e8ddd",
  "css/nuvio-legacy-performance.css": overlayHashes["css/nuvio-legacy-performance.css"]
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(fullPath)));
    else if (entry.isFile()) output.push(fullPath);
  }
  return output;
}

assert(await exists(appDir), `Missing staged webOS app: ${appDir}`);
const appInfo = JSON.parse(await readFile(path.join(appDir, "appinfo.json"), "utf8"));
const expectedMetadata = await readAppMetadata();
assert(appInfo.id === "space.nuvio.webos", `Unexpected app id: ${appInfo.id}`);
assert(
  appInfo.version === expectedMetadata.version,
  `Package version ${appInfo.version} does not match source version ${expectedMetadata.version}`
);
assert(appInfo.requiredVersion === "4.0.0", `Unsafe webOS requirement: ${appInfo.requiredVersion}`);

const indexHtml = await readFile(path.join(appDir, "index.html"), "utf8");
const orderedIncludes = [
  'class="nuvio-legacy-low-power no-flex-gap no-css-math no-backdrop-filter no-aspect-ratio"',
  'src="assets/runtime/legacy-features.js"',
  'src="nuvio-legacy-polyfills.js"',
  'src="nuvio-legacy-fast-home.js"',
  'href="css/base.css"',
  'href="css/layout.css"',
  'href="css/components.css"',
  'href="css/themes.css"',
  'href="css/nuvio-legacy-performance.css"',
  'src="boot-guard.js"',
  'src="nuvio.env.js"',
  'loadScript("app.bundle.js?v='
];
let previousIndex = -1;
for (const include of orderedIncludes) {
  const includeIndex = indexHtml.indexOf(include);
  assert(includeIndex > previousIndex, `Missing or incorrectly ordered index include: ${include}`);
  previousIndex = includeIndex;
}
assert(
  /loadScript\("app\.bundle\.js\?v=[a-zA-Z0-9.+_-]+"\)/.test(indexHtml),
  "Generated index.html is missing a valid cache-busting loadScript() invocation for app.bundle.js"
);
assert(indexHtml.includes('"minChrome":53'), "Generated compatibility gate is not Chrome 53");
assert(indexHtml.includes('"minVersion":4'), "Generated compatibility gate is not webOS 4");
assert(indexHtml.includes('__NUVIO_BOOT_EPOCH__'), "Generated package is missing the boot epoch");
assert(indexHtml.includes('"html-start": 0'), "Generated package is missing the initial boot mark");

for (const match of indexHtml.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
  const relativeAsset = match[1];
  assert(
    await exists(path.join(appDir, relativeAsset)),
    `Generated index references a missing asset: ${relativeAsset}`
  );
}

for (const [relativePath, expectedHash] of Object.entries(overlayHashes)) {
  const sourcePath = path.join(rootDir, relativePath);
  const stagedPath = path.join(appDir, relativePath);
  assert(await exists(stagedPath), `Missing legacy overlay: ${relativePath}`);
  assert((await sha256(sourcePath)) === expectedHash, `Source overlay hash changed: ${relativePath}`);
  assert(
    (await sha256(stagedPath)) === stagedOverlayHashes[relativePath],
    `Staged overlay hash changed: ${relativePath}`
  );
  const mode = (await stat(stagedPath)).mode & 0o777;
  assert((mode & 0o111) !== 0, `Legacy overlay is not executable/readable with mode 755: ${relativePath}`);
}

const envScript = await readFile(path.join(appDir, "nuvio.env.js"), "utf8");
const valuesMatch = envScript.match(/var values = (\{[\s\S]*?\});\s*for \(var key/);
assert(valuesMatch, "Could not inspect generated runtime environment");
const runtimeValues = JSON.parse(valuesMatch[1]);
for (const key of sensitiveRuntimeKeys) {
  assert(
    String(runtimeValues[key] || "") === placeholderRuntimeValue,
    `Public artifact contains a non-placeholder runtime value: ${key}`
  );
}
const examplePath = path.join(rootDir, "local.example.properties");
if (await exists(examplePath)) {
  const exampleValues = parseProperties(await readFile(examplePath, "utf8"));
  for (const key of sensitiveRuntimeKeys) {
    const value = String(exampleValues[key] || "").trim();
    if (value.length >= 8) {
      assert(!envScript.includes(value), `Public artifact copied local.example value: ${key}`);
    }
  }
}
assert(!(await exists(path.join(appDir, "local.properties"))), "local.properties leaked into package");

const stagedFiles = await walk(appDir);
assert(
  !stagedFiles.some((filePath) => filePath.endsWith(".map")),
  "Source maps must not be included in the production package"
);
const javascriptFiles = stagedFiles.filter((filePath) => filePath.endsWith(".js"));
for (const filePath of javascriptFiles) {
  const source = await readFile(filePath, "utf8");
  parse(source, { ecmaVersion: 2016, sourceType: "script", allowHashBang: true });
}
const applicationJavaScript = javascriptFiles.filter(
  (filePath) => filePath.endsWith("app.bundle.js") || filePath.includes(`${path.sep}chunks${path.sep}`)
);
assert(applicationJavaScript.length >= 10, "Expected route chunks were not emitted");
let totalApplicationBytes = 0;
for (const filePath of applicationJavaScript) {
  const source = await readFile(filePath, "utf8");
  totalApplicationBytes += Buffer.byteLength(source);
  parse(source, { ecmaVersion: 2016, sourceType: "script", allowHashBang: true });
}
const startupBytes = (await stat(path.join(appDir, "app.bundle.js"))).size;
assert(startupBytes <= 750_000, `Startup bundle regression: ${startupBytes} bytes`);
assert(totalApplicationBytes <= 2_500_000, `Total JavaScript regression: ${totalApplicationBytes} bytes`);

const unsupportedRegexPattern = /\(\?<[=!0-9A-Za-z_]/;
for (const filePath of javascriptFiles) {
  const source = await readFile(filePath, "utf8");
  assert(
    !unsupportedRegexPattern.test(source),
    `Emitted file contains Chromium 53 unsupported RegExp feature: ${filePath}`
  );
}

const report = {
  verifiedAt: new Date().toISOString(),
  appId: appInfo.id,
  version: appInfo.version,
  requiredVersion: appInfo.requiredVersion,
  chromeTarget: 53,
  startupBytes,
  totalApplicationBytes,
  chunkCount: applicationJavaScript.length - 1,
  runtimeEnvironment: "placeholder-only",
  overlayHashes,
  stagedOverlayHashes
};
await mkdir(reportDir, { recursive: true });
await writeFile(
  path.join(reportDir, "verification.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
await writeFile(
  path.join(reportDir, "DO-NOT-INSTALL-YET.txt"),
  "This package passed static checks but has not passed live TV navigation/playback acceptance. Runtime environment values are placeholders.\n",
  "utf8"
);
console.log(JSON.stringify(report, null, 2));
