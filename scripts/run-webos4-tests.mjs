import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function findTestFiles(dir) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".cache") {
      results.push(...(await findTestFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".test.mjs")) {
      results.push(full);
    }
  }
  return results;
}

const testFiles = (await findTestFiles(rootDir)).sort();
if (!testFiles.length) {
  console.error("No test files found.");
  process.exit(1);
}

// Ensure NODE_OPTIONS does not conflict with --test on wrapped environments (e.g. Termux)
const env = { ...process.env };
delete env.NODE_OPTIONS;

// Prefer the native Termux node binary if present
const termuxNode = "/data/data/com.termux/files/usr/bin/node";
const nodeBin = existsSync(termuxNode)
  ? termuxNode
  : (process.platform === "android" && process.env.PREFIX
      ? path.join(process.env.PREFIX, "bin", "node")
      : process.execPath);

const child = spawn(nodeBin, ["--test", ...testFiles], {
  stdio: "inherit",
  env
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
