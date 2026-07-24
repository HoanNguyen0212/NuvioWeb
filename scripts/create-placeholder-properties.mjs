import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENV_PROPERTY_KEYS } from "./envProperties.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const marker = "__NUVIO_PRIVATE_RUNTIME_VALUE__";
const contents = `${ENV_PROPERTY_KEYS.map((key) => `${key}=${marker}`).join("\n")}\n`;
await writeFile(path.join(rootDir, "local.properties"), contents, { mode: 0o600 });
console.log("Created placeholder-only local.properties for public CI packaging.");
