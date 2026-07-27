import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild-wasm";
import { readAppMetadata, syncVersionFiles } from "./appMetadata.mjs";
import { compatibilityPolicy } from "./compatibilityPolicy.mjs";
import { runWebOsToolsBinary } from "./aresCli.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const cacheDir = path.join(rootDir, ".cache");
const stagingDir = path.join(cacheDir, "webos-package");
const appStageDir = path.join(stagingDir, "app");
const serviceStageDir = path.join(stagingDir, "space.nuvio.webos.service");

const appName = "Nuvio TV";
const webOsServiceId = "space.nuvio.webos.service";
const webOsServiceSourceDir = path.join(rootDir, "services", "webos");
const webOsRuntimeScriptPath = "assets/libs/webOSTV.js";

async function assertDistExists() {
  try {
    await access(path.join(distDir, "app.bundle.js"), fsConstants.R_OK);
    await access(path.join(distDir, "appinfo.json"), fsConstants.R_OK);
  } catch {
    throw new Error(`Build output not found at ${distDir}. Run "npm run build" first.`);
  }
}

async function pathExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveWebOsScriptPath(targetDir) {
  const webOsScriptPath = path.join(targetDir, webOsRuntimeScriptPath);
  if (!(await pathExists(webOsScriptPath))) {
    return "";
  }

  return webOsRuntimeScriptPath;
}

function buildWebOsIndexHtml({ webOsScriptPath = "" } = {}) {
  const webOsScriptTag = webOsScriptPath ? `  <script src="${webOsScriptPath}"></script>\n` : "";
  const compatibilityOptions = JSON.stringify({
    platform: "webos",
    minVersion: Number.parseInt(compatibilityPolicy.webOsRequiredVersion, 10),
    minChrome: compatibilityPolicy.webOsChromiumVersion,
    requiredLabel: `LG webOS ${compatibilityPolicy.webOsRequiredVersion}+ · Chromium ${compatibilityPolicy.webOsChromiumVersion}+ (${compatibilityPolicy.webOsSupportYear}+)`
  });

  return `<!DOCTYPE html>
<html lang="en" class="nuvio-legacy-low-power no-flex-gap no-css-math no-backdrop-filter no-aspect-ratio">
<head>
  <script>
    window.__NUVIO_BOOT_EPOCH__ = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    window.__NUVIO_EARLY_BOOT_MARKS__ = { "html-start": 0 };
  </script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${appName}</title>
  <style>
    #boot-welcome {
      position: fixed;
      z-index: 2147483646;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: #0f1115;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
    }
    #boot-welcome img {
      width: 220px;
      max-width: 40vw;
      height: auto;
      margin-bottom: 24px;
    }
    #boot-welcome .boot-spinner {
      width: 36px;
      height: 36px;
      border: 3px solid rgba(255, 255, 255, 0.15);
      border-top-color: #e50914;
      border-radius: 50%;
      animation: boot-spin 0.8s linear infinite;
    }
    @keyframes boot-spin {
      to { transform: rotate(360deg); }
    }
  </style>
  <script src="assets/runtime/legacy-features.js"></script>
  <script src="nuvio-legacy-polyfills.js"></script>
  <script src="nuvio-legacy-fast-home.js"></script>
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/layout.css" />
  <link rel="stylesheet" href="css/components.css" />
  <link rel="stylesheet" href="css/themes.css" />
  <link rel="stylesheet" href="css/nuvio-legacy-performance.css" />
</head>
<body>
  <div id="boot-welcome">
    <img src="assets/brand/app_logo_wordmark.png" alt="Nuvio" />
    <div class="boot-spinner"></div>
  </div>
  <script src="boot-guard.js"></script>
  <script>window.__NUVIO_PLATFORM__ = "webos";</script>
  <script src="nuvio.env.js"></script>
${webOsScriptTag}  <script>
    window.NuvioBootGuard.runCompatibilityGate(${compatibilityOptions}, function startNuvioApp() {
      window.NuvioBootGuard.loadScript("app.bundle.js");
    });
  </script>
</body>
</html>
`;
}

async function stageApp() {
  const { version } = await readAppMetadata();
  await cp(distDir, appStageDir, { recursive: true });

  const appInfoPath = path.join(appStageDir, "appinfo.json");
  const appInfo = JSON.parse(await readFile(appInfoPath, "utf8"));
  appInfo.title = appName;
  appInfo.version = version;
  appInfo.requiredVersion = compatibilityPolicy.webOsRequiredVersion;
  appInfo.icon = "icon.png";
  appInfo.largeIcon = "largeIcon.png";
  appInfo.services = [webOsServiceId];
  await writeFile(appInfoPath, `${JSON.stringify(appInfo, null, 2)}\n`, "utf8");

  await Promise.all([
    cp(path.join(rootDir, "assets", "images", "icon.png"), path.join(appStageDir, "icon.png")),
    cp(
      path.join(rootDir, "assets", "images", "largeIcon.png"),
      path.join(appStageDir, "largeIcon.png")
    ),
    cp(path.join(rootDir, "assets", "images", "splash.png"), path.join(appStageDir, "splash.png"))
  ]);

  const webOsScriptPath = await resolveWebOsScriptPath(appStageDir);
  await writeFile(
    path.join(appStageDir, "index.html"),
    buildWebOsIndexHtml({ webOsScriptPath }),
    "utf8"
  );
}

async function stageService() {
  const packageJsonPath = path.join(webOsServiceSourceDir, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

  await mkdir(path.join(serviceStageDir, "src"), { recursive: true });
  await mkdir(path.join(serviceStageDir, "runtime"), { recursive: true });

  await Promise.all([
    writeFile(
      path.join(serviceStageDir, "package.json"),
      `${JSON.stringify(packageJson, null, 2)}\n`,
      "utf8"
    ),
    cp(
      path.join(webOsServiceSourceDir, "services.json"),
      path.join(serviceStageDir, "services.json")
    ),
    cp(
      path.join(webOsServiceSourceDir, "runtime", "media-http.cjs"),
      path.join(serviceStageDir, "runtime", "media-http.cjs")
    )
  ]);

  await build({
    entryPoints: [path.join(webOsServiceSourceDir, "src", "index.js")],
    outfile: path.join(serviceStageDir, "src", "index.js"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: [`node${compatibilityPolicy.webOsServiceNodeVersion}`],
    external: ["webos-service"],
    logLevel: "silent"
  });
}

async function packageWebOs() {
  await syncVersionFiles();
  await assertDistExists();

  console.log("staging webOS package files...");
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });
  await Promise.all([stageApp(), stageService()]);

  console.log("creating webOS IPK...");
  try {
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    await runWebOsToolsBinary("ares-package", [
      "--no-minify",
      appStageDir,
      serviceStageDir,
      "--outdir",
      rootDir
    ], { env });
  } catch (error) {
    const { version } = await readAppMetadata();
    const expectedIpk = path.join(rootDir, `space.nuvio.webos_${version}_all.ipk`);
    if (await pathExists(expectedIpk)) {
      console.warn(
        `ares-package exited with an error, but ${expectedIpk} was created successfully. Continuing.`
      );
    } else {
      throw error;
    }
  }
}

try {
  await packageWebOs();
} catch (error) {
  console.error("\nwebOS packaging failed:");
  console.error(error);
  process.exit(1);
}
