import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";

const problems = [];

// 1) Git conflict markers in relevant versioned source files
const ROOTS = ["css", "js", "assets", "scripts", "services"];
const EXTENSIONS = new Set([".css", ".js", ".mjs", ".cjs", ".json", ".html", ".xml"]);
const CONFLICT_MARKER = /^(<{7}|={7}|>{7})(\s|$)/;

function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "generated" || entry.name === ".cache") continue;
      scanDir(fullPath);
      continue;
    }
    if (!EXTENSIONS.has(path.extname(entry.name))) continue;
    const lines = fs.readFileSync(fullPath, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (CONFLICT_MARKER.test(line.trim())) {
        problems.push(`${fullPath}:${i + 1}: git conflict marker -> ${line.trim().slice(0, 40)}`);
      }
    });
  }
}

ROOTS.filter((r) => fs.existsSync(r)).forEach(scanDir);

// 2) Validate all source CSS files parse cleanly with PostCSS
for (const file of fs.readdirSync("css").filter((f) => f.endsWith(".css"))) {
  const filePath = path.join("css", file);
  try {
    postcss.parse(fs.readFileSync(filePath, "utf8"), { from: filePath });
  } catch (error) {
    problems.push(`${filePath}: CSS parse error -> ${error.message}`);
  }
}

if (problems.length > 0) {
  console.error(`Source integrity check failed: ${problems.length} problem(s) found`);
  for (const p of problems) {
    console.error(`  ${p}`);
  }
  process.exit(1);
}

console.log("check:source: zero conflict markers, all CSS parses cleanly");
