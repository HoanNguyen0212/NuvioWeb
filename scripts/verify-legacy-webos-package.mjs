import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";
import { parseProperties } from "./envProperties.mjs";

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
  "nuvio-legacy-fast-home.js": "6395e3759c6bc79a373b61e1e048113c7f96c16cc3c2f7ead32b75e1abd72359",
  "nuvio-legacy-polyfills.js": "e04badf84cf5b286d318cb0219da0eb17c5aa1932856ed002db575fd3d1505c2",
  "css/nuvio-legacy-performance.css": "0d67d40b6f1905823f161183b7519572b370ffad4ae5ac4eb3659f8856807881"
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
assert(appInfo.id === "space.nuvio.webos", `Unexpected app id: ${appInfo.id}`);
assert(appInfo.version === "0.3.24", `Unexpected app version: ${appInfo.version}`);
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
  'loadScript("app.bundle.js")'
];
let previousIndex = -1;
for (const include of orderedIncludes) {
  const includeIndex = indexHtml.indexOf(include);
  assert(includeIndex > previousIndex, `Missing or incorrectly ordered index include: ${include}`);
  previousIndex = includeIndex;
}
assert(indexHtml.includes('"minChrome":53'), "Generated compatibility gate is not Chrome 53");
assert(indexHtml.includes('"minVersion":4'), "Generated compatibility gate is not webOS 4");

for (const [relativePath, expectedHash] of Object.entries(overlayHashes)) {
  const sourcePath = path.join(rootDir, relativePath);
  const stagedPath = path.join(appDir, relativePath);
  assert(await exists(stagedPath), `Missing legacy overlay: ${relativePath}`);
  assert((await sha256(sourcePath)) === expectedHash, `Source overlay hash changed: ${relativePath}`);
  assert((await sha256(stagedPath)) === expectedHash, `Staged overlay hash changed: ${relativePath}`);
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

const javascriptFiles = (await walk(appDir)).filter((filePath) => filePath.endsWith(".js"));
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
assert(startupBytes <= 550_000, `Startup bundle regression: ${startupBytes} bytes`);
assert(totalApplicationBytes <= 2_250_000, `Total JavaScript regression: ${totalApplicationBytes} bytes`);

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
  overlayHashes
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
