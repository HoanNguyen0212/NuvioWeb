import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve("dist");
if (!fs.existsSync(DIST)) {
  console.error("dist/ does not exist. Run the build before checking legacy regex.");
  process.exit(2);
}

function findJsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".js") && !entry.name.endsWith(".map")) {
      results.push(full);
    }
  }
  return results;
}

const files = findJsFiles(DIST);
const problems = [];

for (const filePath of files) {
  const relName = path.relative(DIST, filePath);
  const src = fs.readFileSync(filePath, "utf8");

  for (const m of src.matchAll(/new RegExp\((?:[^,()]|\([^)]*\))*,\s*"([a-z]+)"/g)) {
    if (m[1].includes("s")) {
      problems.push(`${relName}: dotAll flag "s" in new RegExp(..., "${m[1]}") @ offset ${m.index}`);
    }
  }
  for (const m of src.matchAll(/\(\?<[=!]/g)) {
    problems.push(`${relName}: regex lookbehind @ offset ${m.index}`);
  }
  for (const m of src.matchAll(/\(\?<[A-Za-z_]/g)) {
    problems.push(`${relName}: named capture group @ offset ${m.index}`);
  }
}

if (problems.length > 0) {
  console.error(`Incompatible Chromium 53 regex features found: ${problems.length}`);
  for (const p of problems.slice(0, 40)) {
    console.error(`  ${p}`);
  }
  console.error("\nUse [\\s\\S] instead of the 's' flag; rewrite lookbehinds and named capture groups.");
  process.exit(1);
}

console.log(`regex: zero post-ES2017 regex features across ${files.length} emitted JS files in dist/`);
