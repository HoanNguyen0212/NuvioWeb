import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportDir = path.join(rootDir, ".cache", "legacy-analysis");
const bundlePath = path.join(rootDir, "dist", "app.bundle.js");
const bundle = await stat(bundlePath);

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeName(name) {
  const value = String(name || "").replaceAll("\\", "/");
  if (path.isAbsolute(value)) {
    return path.relative(rootDir, value).replaceAll("\\", "/");
  }
  return value.replace(/^\.\//, "");
}

function flattenModules(modules = [], output = []) {
  for (const module of modules || []) {
    if (Array.isArray(module.modules)) {
      flattenModules(module.modules, output);
    } else {
      output.push(module);
    }
  }
  return output;
}

const webpackStatsPath = path.join(reportDir, "webpack-stats.json");
const esbuildMetadataPath = path.join(reportDir, "esbuild-meta.json");
let summary;

if (await exists(webpackStatsPath)) {
  const stats = JSON.parse(await readFile(webpackStatsPath, "utf8"));
  const assets = (stats.assets || [])
    .filter((asset) => String(asset.name || "").endsWith(".js"))
    .map((asset) => ({ name: asset.name, bytes: Number(asset.size || 0) }))
    .sort((left, right) => right.bytes - left.bytes);
  const rawChunks = stats.chunks || [];
  const chunks = rawChunks.map((chunk) => ({
    id: chunk.id,
    names: chunk.names || [],
    initial: Boolean(chunk.initial),
    files: chunk.files || [],
    bytes: flattenModules(chunk.modules || []).reduce(
      (total, module) => total + Number(module.size || 0),
      0
    )
  }));
  const mapModule = (module) => ({
    name: normalizeName(module.nameForCondition || module.name || module.identifier),
    sourceBytes: Number(module.size || 0),
    chunks: module.chunks || []
  });
  const allModules = flattenModules(stats.modules || [])
    .map(mapModule)
    .filter((module) => module.name && !module.name.startsWith("webpack/runtime/"))
    .sort((left, right) => right.sourceBytes - left.sourceBytes);
  const initialChunkIds = new Set(
    rawChunks.filter((chunk) => chunk.initial).map((chunk) => String(chunk.id))
  );
  const startupModuleMap = new Map();
  const startupCandidates = [
    ...allModules.filter((module) =>
      module.chunks.some((chunkId) => initialChunkIds.has(String(chunkId)))
    ),
    ...rawChunks
      .filter((chunk) => chunk.initial)
      .flatMap((chunk) => flattenModules(chunk.modules || []))
      .map(mapModule)
  ];
  startupCandidates
    .filter((module) => module.name && !module.name.startsWith("webpack/runtime/"))
    .forEach((module) => {
      const existing = startupModuleMap.get(module.name);
      if (!existing || module.sourceBytes > existing.sourceBytes) {
        startupModuleMap.set(module.name, module);
      }
    });
  const startupModules = Array.from(startupModuleMap.values()).sort(
    (left, right) => right.sourceBytes - left.sourceBytes
  );

  summary = {
    generatedAt: new Date().toISOString(),
    bundler: "webpack",
    bundleBytes: bundle.size,
    totalJavaScriptBytes: assets.reduce((total, asset) => total + asset.bytes, 0),
    javascriptAssetCount: assets.length,
    inputCount: allModules.length,
    chromeTarget: 53,
    assets,
    chunks,
    largestStartupModules: startupModules.slice(0, 100),
    largestSourceInputs: allModules.slice(0, 100),
    largestBundleContributors: startupModules
      .slice(0, 100)
      .map((item) => ({ name: item.name, bytesInOutput: item.sourceBytes }))
  };
} else {
  const metadata = JSON.parse(await readFile(esbuildMetadataPath, "utf8"));
  const inputs = Object.entries(metadata.inputs || {})
    .map(([name, details]) => ({
      name: normalizeName(name),
      sourceBytes: Number(details.bytes || 0)
    }))
    .sort((left, right) => right.sourceBytes - left.sourceBytes);
  const output = Object.values(metadata.outputs || {}).find((item) => item.entryPoint);
  const contributions = Object.entries(output?.inputs || {})
    .map(([name, details]) => ({
      name: normalizeName(name),
      bytesInOutput: Number(details.bytesInOutput || 0)
    }))
    .sort((left, right) => right.bytesInOutput - left.bytesInOutput);
  summary = {
    generatedAt: new Date().toISOString(),
    bundler: "esbuild",
    bundleBytes: bundle.size,
    totalJavaScriptBytes: bundle.size,
    javascriptAssetCount: 1,
    inputCount: inputs.length,
    chromeTarget: 53,
    assets: [{ name: "app.bundle.js", bytes: bundle.size }],
    largestSourceInputs: inputs.slice(0, 100),
    largestBundleContributors: contributions.slice(0, 100)
  };
}

const formatBytes = (bytes) => new Intl.NumberFormat("en-US").format(bytes);
const markdown = [
  "# Nuvio legacy webOS 53 bundle analysis",
  "",
  `- Generated: ${summary.generatedAt}`,
  `- Bundler: ${summary.bundler}`,
  `- Startup bundle: ${formatBytes(summary.bundleBytes)} bytes`,
  `- Total JavaScript: ${formatBytes(summary.totalJavaScriptBytes)} bytes`,
  `- JavaScript assets: ${summary.javascriptAssetCount}`,
  `- Input modules: ${summary.inputCount}`,
  `- JavaScript target: Chrome ${summary.chromeTarget}`,
  "",
  "## JavaScript assets",
  "",
  "| Bytes | Asset |",
  "| ---: | --- |",
  ...(summary.assets || []).map((asset) => `| ${formatBytes(asset.bytes)} | \`${asset.name}\` |`),
  "",
  "## Largest startup contributors",
  "",
  "| Approximate source bytes | Module |",
  "| ---: | --- |",
  ...summary.largestBundleContributors.map(
    (item) => `| ${formatBytes(item.bytesInOutput)} | \`${item.name}\` |`
  ),
  ""
].join("\n");

await mkdir(reportDir, { recursive: true });
await Promise.all([
  writeFile(path.join(reportDir, "bundle-analysis.json"), `${JSON.stringify(summary, null, 2)}\n`),
  writeFile(path.join(reportDir, "bundle-analysis.md"), markdown)
]);

console.log(`legacy bundle analysis written to ${reportDir}`);
