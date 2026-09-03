/**
 * Grep gate for CSS the webOS 4 / Chromium 53 engine cannot use natively.
 *
 * Checks fallback coverage for modern CSS declarations (CSS Grid, min/max/clamp, gap,
 * backdrop-filter, aspect-ratio). A declaration is fine when a rule scoped to the matching
 * `no-*` class (which the boot guard stamps on <html>) provides a legacy path.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssDir = path.join(rootDir, "css");

const FEATURES = [
  {
    name: "CSS Grid",
    since: 57,
    fallbackClass: "no-css-grid",
    re: /(^|[;{\s])(display\s*:\s*(inline-)?grid|grid-template|grid-column|grid-row|grid-area|grid-auto|justify-items|place-items|place-content)\b/i
  },
  {
    name: "min()/max()/clamp()",
    since: 79,
    fallbackClass: "no-css-math",
    re: /[:\s(](min|max|clamp)\(/i
  },
  {
    name: "flex/grid gap",
    since: 84,
    fallbackClass: "no-flex-gap",
    re: /(^|[;{\s])(gap|row-gap|column-gap)\s*:/i
  },
  {
    name: "backdrop-filter",
    since: 76,
    fallbackClass: "no-backdrop-filter",
    re: /(^|[;{\s])(-webkit-)?backdrop-filter\s*:/i
  },
  {
    name: "aspect-ratio",
    since: 88,
    fallbackClass: "no-aspect-ratio",
    re: /(^|[;{\s])aspect-ratio\s*:/i
  },
  {
    name: "content-visibility",
    since: 85,
    fallbackClass: null,
    re: /(^|[;{\s])content-visibility\s*:/i
  },
  { name: "position: sticky", since: 56, fallbackClass: null, re: /position\s*:\s*sticky/i },
  {
    name: ":focus-visible",
    since: 86,
    fallbackClass: null,
    re: /:focus-visible\b/i
  }
];

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

const distCssDir = path.join(rootDir, "dist", "css");
let distText = "";
try {
  for (const f of (await readdir(distCssDir)).filter((n) => n.endsWith(".css"))) {
    distText += await readFile(path.join(distCssDir, f), "utf8");
  }
} catch (_) {
  distText = "";
}

const files = (await readdir(cssDir)).filter((f) => f.endsWith(".css"));
const findings = [];
const fallbackCounts = new Map();

for (const file of files) {
  const raw = await readFile(path.join(cssDir, file), "utf8");
  const text = stripComments(raw);
  const lines = text.split("\n");
  for (const feature of FEATURES) {
    lines.forEach((line, index) => {
      if (feature.re.test(line)) {
        findings.push({
          file,
          line: index + 1,
          feature: feature.name,
          since: feature.since,
          text: line.trim().slice(0, 88)
        });
      }
    });
  }
}

const byFeature = new Map();
findings.forEach((f) => {
  if (!byFeature.has(f.feature)) byFeature.set(f.feature, []);
  byFeature.get(f.feature).push(f);
});

FEATURES.forEach((feature) => {
  if (!feature.fallbackClass) return;
  const count = distText
    ? (distText.match(new RegExp("no-" + feature.fallbackClass.replace(/^no-/, ""), "g")) || [])
        .length
    : -1;
  fallbackCounts.set(feature.name, count);
});

console.log("Chromium 53 (webOS 4) CSS fallback coverage report:");
console.log(
  distText
    ? "(measured against dist/ CSS output)\n"
    : "(dist/ not present; run build first for dist coverage)\n"
);
for (const feature of FEATURES) {
  const hits = byFeature.get(feature.name) || [];
  if (!hits.length) continue;
  const fallbacks = feature.fallbackClass ? fallbackCounts.get(feature.name) || 0 : 0;
  const status = !feature.fallbackClass
    ? "no class-based fallback"
    : fallbacks < 0
      ? "coverage unknown (no dist/)"
      : fallbacks === 0
        ? "warning: zero occurrences in dist/"
        : `fallback \`${feature.fallbackClass}\` in dist/: ${fallbacks} occurrences`;
  console.log(`${feature.name} (Chrome ${feature.since}) — ${hits.length} uses, ${status}`);
}
console.log(`\nTotal modern CSS usages scanned: ${findings.length}`);
