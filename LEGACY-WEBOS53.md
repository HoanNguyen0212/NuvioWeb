# Legacy LG webOS / Chromium 53 branch

This branch is an experimental compatibility and performance port for a rooted LG TV running Chromium 53.

## Safety status

The public Actions package contains placeholder runtime values and is deliberately named `UNTESTED`. Do not install it as-is. It must first receive a private runtime environment and pass offline inspection, full TV backup, cold-start, navigation, Settings, and playback acceptance.

## Build policy

- JavaScript syntax target: Chrome 53 / ECMAScript 2016 or older
- Webpack runtime target: ES5
- Runtime gate: Chromium 53
- webOS package requirement: 4.0.0
- webOS service target: Node 8 (unchanged)
- `ares-package --no-minify`: Webpack has already minified the output and the old ares minifier cannot parse the chunked bundle
- No account, cloud, addon, or private runtime values are committed or uploaded

## Implemented optimization

The upstream application bundled every route into a 2,103,280-byte startup file. This branch keeps Home and core startup code in `app.bundle.js`, while Webpack emits player, detail, Settings, search, library, stream, profile, plugin, and other routes as classic JSONP script chunks. Chromium 53 does not need native ES modules or native dynamic `import()` support.

Current verified source measurements:

- Startup JavaScript: 492,220 bytes, down 76.6% from 2,103,280 bytes
- Async/background chunks: 28
- Total application JavaScript: 2,145,907 bytes, loaded only as routes need it
- Player stack deferred: about 530 KB
- Detail screen deferred: about 222 KB
- Settings deferred: about 183 KB
- Trakt / profile / continue-watching API and deferred catalog rows run strictly after first Home mount and focus, avoiding startup rendering block.
- Skeleton UI and window.__NUVIO_BOOT_MARKS__ timestamp tracker active for boot profiling.
- Addon-remote UI and profile/background sync are deferred until requested or Home is usable
- Core-js was removed from the Home bundle; the preloaded legacy file supplies only the APIs missing on Chrome 53, including record-form `URLSearchParams`

The build verifier parses every app/chunk file as ECMAScript 2016, enforces startup/total size ceilings, checks package metadata and legacy load order, confirms exact overlay hashes/modes, and rejects non-placeholder environment values in public artifacts. A Node VM test models Chrome 53's missing APIs and validates the lightweight polyfills.

## Ported legacy overlay

- `nuvio-legacy-polyfills.js`
- `nuvio-legacy-fast-home.js`
- `css/nuvio-legacy-performance.css`
- `nuvio-legacy-low-power` root class
- Legacy feature detection before polyfills
- Performance CSS loaded last
- BootGuard compatibility gate and chunked `app.bundle.js` loading

The custom files are copied by `scripts/build.mjs`, included by the generated webOS template in `scripts/package-webos.mjs`, and retain mode 755.

## Workflows

- `.github/workflows/legacy-webos53-analysis.yml`: analysis reports only
- `.github/workflows/build-legacy-webos53.yml`: placeholder candidate IPK plus checksums, unpacked manifest, bundle report, and static verification

## Remaining acceptance stages

1. Create a fresh pre-update TV backup while the TV is online.
2. Inject the existing private runtime environment offline; never upload that package.
3. Independently inspect the repacked IPK and checksum.
4. Install only the private candidate.
5. Test cold launch and every lazy route: Home, detail, stream, player, Settings, search, library, plugins, See All, folder, cast, profile, and auth screens.
6. Confirm first HLS/DASH playback loads on demand and video time/buffer advance.
7. Compare startup, focus latency, DOM/RAM, catalog visibility, and cloud state with the 0.3.22 baseline.
8. Roll back immediately if compatibility or responsiveness regresses.

The official release package remains a comparison artifact. A direct Homebrew update is not safe for this TV.
