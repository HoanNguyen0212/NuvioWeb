import { ESLint } from "eslint";

const eslint = new ESLint();
const results = await eslint.lintFiles(["js/**/*.js", "scripts/**/*.{js,mjs}"]);
const findings = [];

for (const result of results) {
  for (const message of result.messages) {
    if (message.ruleId === "no-undef") {
      const relPath = result.filePath.replace(process.cwd() + "/", "");
      findings.push(`${relPath}:${message.line}:${message.column} ${message.message}`);
    }
  }
}

if (findings.length > 0) {
  console.error(`Undeclared identifiers found: ${findings.length}`);
  for (const finding of findings) {
    console.error(`  ${finding}`);
  }
  process.exit(1);
}

console.log("no-undef: zero orphaned identifiers found in js/ and scripts/");
