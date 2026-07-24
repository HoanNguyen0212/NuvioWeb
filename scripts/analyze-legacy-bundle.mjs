import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportDir = path.join(rootDir, ".cache", "legacy-analysis");
const metadataPath = path.join(reportDir, "esbuild-meta.json");
const bundlePath = path.join(rootDir, "dist", "app.bundle.js");
const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
const bundle = await stat(bundlePath);

const inputs = Object.entries(metadata.inputs || {})
  .map(([name, details]) => ({
    name: path.relative(rootDir, path.resolve(rootDir, name)),
    sourceBytes: Number(details.bytes || 0)
  }))
  .sort((left, right) => right.sourceBytes - left.sourceBytes);

const output = Object.values(metadata.outputs || {}).find((item) => item.entryPoint);
const contributions = Object.entries(output?.inputs || {})
  .map(([name, details]) => ({
    name: path.relative(rootDir, path.resolve(rootDir, name)),
    bytesInOutput: Number(details.bytesInOutput || 0)
  }))
  .sort((left, right) => right.bytesInOutput - left.bytesInOutput);

const summary = {
  generatedAt: new Date().toISOString(),
  bundleBytes: bundle.size,
  inputCount: inputs.length,
  chromeTarget: 53,
  largestSourceInputs: inputs.slice(0, 50),
  largestBundleContributors: contributions.slice(0, 100)
};

const formatBytes = (bytes) => new Intl.NumberFormat("en-US").format(bytes);
const markdown = [
  "# Nuvio legacy webOS 53 bundle analysis",
  "",
  `- Generated: ${summary.generatedAt}`,
  `- Bundle: ${formatBytes(summary.bundleBytes)} bytes`,
  `- Input modules: ${summary.inputCount}`,
  `- JavaScript target: Chrome ${summary.chromeTarget}`,
  "",
  "## Largest bundle contributors",
  "",
  "| Bytes in bundle | Module |",
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
