import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
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
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${appName}</title>
  <script src="assets/runtime/legacy-features.js"></script>
  <script>
    window.__NUVIO_BOOT_MARKS__ = [];
    window.__NUVIO_BOOT_MARK__ = function (name) {
      var now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      window.__NUVIO_BOOT_MARKS__.push({ name: name, t: Math.round(now) });
      if (name === "home-focused" || name === "home-mounted") {
        try {
          var first = window.__NUVIO_BOOT_MARKS__[0] ? window.__NUVIO_BOOT_MARKS__[0].t : 0;
          var summary = window.__NUVIO_BOOT_MARKS__.map(function (m) {
            return m.name + ":" + (m.t - first) + "ms";
          }).join(" | ");
          console.log("[nuvio-boot-marks] " + summary);
        } catch (_) {}
      }
    };
    window.__NUVIO_BOOT_MARK__("boot-start");
  </script>
  <script src="nuvio-legacy-polyfills.js"></script>
  <script src="nuvio-legacy-fast-home.js"></script>
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/layout.css" />
  <link rel="stylesheet" href="css/components.css" media="print" onload="this.media='all';this.onload=null;" />
  <link rel="stylesheet" href="css/themes.css" media="print" onload="this.media='all';this.onload=null;" />
  <link rel="stylesheet" href="css/nuvio-legacy-performance.css" />
</head>
<body>
  <div id="nuvio-boot-skeleton" class="nuvio-boot-skeleton">
    <div class="nuvio-skeleton-sidebar">
      <div class="nuvio-skeleton-logo"></div>
      <div class="nuvio-skeleton-nav-item"></div>
      <div class="nuvio-skeleton-nav-item"></div>
      <div class="nuvio-skeleton-nav-item"></div>
    </div>
    <div class="nuvio-skeleton-main">
      <div class="nuvio-skeleton-hero"></div>
      <div class="nuvio-skeleton-row">
        <div class="nuvio-skeleton-card"></div>
        <div class="nuvio-skeleton-card"></div>
        <div class="nuvio-skeleton-card"></div>
        <div class="nuvio-skeleton-card"></div>
      </div>
      <div class="nuvio-skeleton-row">
        <div class="nuvio-skeleton-card"></div>
        <div class="nuvio-skeleton-card"></div>
        <div class="nuvio-skeleton-card"></div>
        <div class="nuvio-skeleton-card"></div>
      </div>
    </div>
  </div>
  <style>
    .nuvio-boot-skeleton {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 99999;
      background: #0d0d0d;
      display: flex;
      box-sizing: border-box;
      pointer-events: none;
    }
    .nuvio-boot-skeleton.hidden { display: none !important; }
    .nuvio-skeleton-sidebar { width: 104px; padding: 32px 16px; background: #121212; display: flex; flex-direction: column; align-items: center; }
    .nuvio-skeleton-logo { width: 48px; height: 48px; border-radius: 50%; background: #222; margin-bottom: 40px; }
    .nuvio-skeleton-nav-item { width: 36px; height: 36px; border-radius: 8px; background: #1c1c1c; margin-bottom: 24px; }
    .nuvio-skeleton-main { flex: 1; padding: 40px 48px; display: flex; flex-direction: column; }
    .nuvio-skeleton-hero { width: 100%; height: 280px; border-radius: 16px; background: #181818; margin-bottom: 36px; }
    .nuvio-skeleton-row { display: flex; gap: 16px; margin-bottom: 28px; }
    .nuvio-skeleton-card { width: 180px; height: 260px; border-radius: 12px; background: #1c1c1c; flex-shrink: 0; }
  </style>
  <script>if (window.__NUVIO_BOOT_MARK__) window.__NUVIO_BOOT_MARK__("skeleton-shown");</script>
  <script src="boot-guard.js"></script>
  <script>if (window.__NUVIO_BOOT_MARK__) window.__NUVIO_BOOT_MARK__("boot-guard-done");</script>
  <script>window.__NUVIO_PLATFORM__ = "webos";</script>
  <script src="nuvio.env.js"></script>
  <script>
    window.__loadQrCodeGenerator = function () {
      if (window.qrcode || window.__qrCodeLoading) return Promise.resolve();
      window.__qrCodeLoading = true;
      return new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = "assets/libs/qrcode-generator.js";
        s.onload = function () { resolve(); };
        s.onerror = reject;
        document.body.appendChild(s);
      });
    };
  </script>
${webOsScriptTag}  <script>
    if (window.__NUVIO_BOOT_MARK__) window.__NUVIO_BOOT_MARK__("bundle-start");
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
    await runWebOsToolsBinary("ares-package", [
      "--no-minify",
      appStageDir,
      serviceStageDir,
      "--outdir",
      rootDir
    ]);
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
