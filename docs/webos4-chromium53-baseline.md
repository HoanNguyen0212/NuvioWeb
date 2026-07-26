# webOS 4.9 / Chromium 53 optimization baseline

Branch baseline: `legacy-webos53-v49-opt` at `1e8ffe0`  
Working branch: `webos4-chromium53`  
Captured: 2026-07-26

This document records measured/static baseline facts before the next optimization phases. It contains no private runtime configuration.

## Build and package baseline

Command: `npm run build:webos53-fastboot`

| Artifact | Baseline |
|---|---:|
| Startup bundle (`dist/app.bundle.js`) | 697,310 B |
| Route/lazy chunks | 28 files / 1,656,870 B |
| Player route chunk | 531,919 B |
| Search route chunk | 90,093 B |
| Detail route chunk | 222,677 B |
| CSS total | 410,471 B |
| Main component CSS | 392,198 B |
| Legacy performance CSS | 15,579 B |
| Boot guard | 21,745 B |
| Legacy polyfills | 10,872 B |
| Fast-home overlay | 3,928 B |
| Current IPK | 3,828,470 B |

`dist/index.html` declares five startup scripts: `legacy-features.js`, `boot-guard.js`, `js/core/diagnostics/bootMetrics.js`, `nuvio.env.js`, and `app.bundle.js`. The built `dist` currently does **not** contain the declared standalone `js/core/diagnostics/bootMetrics.js`; boot metrics are also imported by application code, but the missing direct file is a package-integrity defect to address in the boot/verifier phase.

The startup request count before a trustworthy `home-focused` mark is not available yet because that mark does not exist. Do not infer it from the old `router-ready` mark.

## Home baseline on the LG TV

Measured through CDP on the actual LG webOS 4.9 TV after Home settled. This is one warm runtime sample, not a cold-boot benchmark.

| Metric | Baseline |
|---|---:|
| `.home-row` | 17 |
| `.home-content-card` | 164 |
| `.focusable` | 169 |
| `.focusable.focused` | 1 |
| All DOM elements | 721 |
| `<img>` elements | 150 |
| Images with `src` | 48 |
| Images retaining `data-src` | 102 |

Static findings:

- Home already emits `data-nav-row`, `data-nav-col`, and `data-nav-row-key`.
- Row limits already exist: default 15, constrained 10, legacy TV 8.
- Persistent-cache hydration additionally slices cached row items to 12.
- Renderer still creates all available row sections at once; row-level incremental mounting is not implemented.
- Manual `data-src` deferral exists, but markup also uses native `loading="lazy"`, which cannot be the required mechanism on Chromium 53.
- `nuvio-legacy-fast-home.js` installs a `MutationObserver` on `document.documentElement` for the complete app lifetime and monkeypatches global `requestIdleCallback`.

## Search baseline

| Setting/behavior | Baseline |
|---|---|
| Minimum query | 3 characters |
| Debounce | 400 ms |
| Provider concurrency | 2 workers |
| Cache TTL | 10 minutes |
| Cache capacity | 50 entries |
| Cache key | query + addon + type + catalog |
| True LRU refresh on hit | No |
| Real request cancellation | No; stale generation token only |
| Watched-history load | `getAll(5000)` awaited during mount |
| Card listeners | Per-card click listeners are rebound |
| Provider rendering | Progressive workers exist, but `renderResultsOnly()` can rebuild the complete results HTML |
| Stable per-provider containers | No |

A previous runtime sample on this TV returned 2 rows / 16 cards for `oppenheimer` in 1,455 ms. It is a functional sample, not a statistical benchmark.

## Focus Engine / Magic Remote baseline

| Item | Baseline |
|---|---|
| Global keyboard listeners | `keydown`, `keyup` capture |
| webOS mouse listeners | one `mousemove`, one `click`, capture |
| `pointermove` listener | none |
| Init guard | none |
| Destroy/unbind lifecycle | none |
| Mouse threshold | 8 px Manhattan distance |
| D-pad mouse lock | 450 ms |
| Activation dedupe | 300 ms / same element |
| Current pointer target cache | `lastPointerFocusTarget` |
| Full focus scan on focus change | yes: `.focusable.focused` |
| Native focus policy | INPUT, TEXTAREA, BUTTON, contenteditable |
| Native focus on movie cards | no |

The timeline fix at `1e8ffe0` must remain intact: 40 px webOS hit area, shell hit-testing, direct `mousedown`, delegated click fallback, 600 ms / 8 px seek dedupe, hidden/modal blocking, and explicit listener cleanup.

## Router and lifecycle baseline

- Router already cleans up the current route and has navigation sequencing checks.
- `Screen.mount()` clears the container and awaits route mount.
- There is no standardized shell/hydrate two-phase interface across all screens.
- Individual screens own timers/listeners and cleanup quality varies.
- Route-token behavior must be audited screen-by-screen before changing the lifecycle contract.

## Player baseline

| Item | Baseline |
|---|---|
| Main UI interval | 1,000 ms calling `updateUiTick()` |
| Initial UI tick | immediate |
| Control row rendering | `renderControlButtons()` replaces `innerHTML` |
| Play/pause rendering | rebuilds control row |
| Timeline direct listener | one capture `mousedown`, explicitly removed |
| Timeline click fallback | Focus Engine delegated `click` |
| Track discovery | bounded polling window exists |
| Skip interval timer | separate interval |
| Skip-intro animation | `requestAnimationFrame` loop |
| Cleanup | extensive, including timeline unbind |

The player route is the largest route chunk at 531,919 B. Changes must remain route-local and must regression-test timeline seeking after every player commit.

## CSS baseline

Static scan found 90 occurrences/files-lines matching expensive or compatibility-sensitive patterns such as blur, `will-change`, infinite animation, and transition-related rules. Important findings:

- `.player-ui-root` intentionally uses `pointer-events:none`; interactive descendants opt back in.
- Legacy/no-backdrop rules exist, but later legacy rules include a `blur(26px) ... !important` override and require cascade review.
- Multiple indefinite shimmer/spinner/preview animations remain.
- Several permanent `will-change` declarations remain.
- Player progress currently transitions `height`; timeline functionality is correct and must not regress when this is changed.

No CSS rule is removed in this baseline phase.

## Build pipeline / Chromium 53 baseline

- `scripts/build.mjs` targets `web` + `es5`, then applies a Chrome-53 compatibility transform.
- Route chunks are emitted separately.
- `scripts/verify-legacy-webos-package.mjs` enforces size and selected compatibility checks, but does not yet parse every JavaScript/inline script with an ES2016 parser or produce the requested API/CSS audit report.
- The player output chunk contains no optional chaining, nullish coalescing, or native `async function`; the established build does retain syntax supported by Chrome 53 such as arrow/rest syntax in some output.
- Direct-copy and inline scripts require separate verification because they do not all follow the route bundle transform path.

## Prioritized risks for the next phases

1. Focus Engine `init()` can duplicate global listeners and has no destroy path.
2. Focus changes query all focused nodes in the active screen.
3. Global fast-home MutationObserver and `requestIdleCallback` monkeypatch have application-wide scope.
4. Search waits for up to 5,000 watched records and rebuilds/rebinds result content.
5. Search has no XHR cancellation contract and cache hit does not refresh LRU order.
6. Player rebuilds controls for state changes and has multiple update sources/timers.
7. Missing standalone boot metrics file is referenced by packaged HTML.
8. Verifier coverage is narrower than the final package surface.

## Measurement rules

- Keep cold/warm boot measurements separate.
- Do not use `router-ready` or `home-shell-rendered` as `home-focused`.
- TV measurements in this document identify whether they are real-device CDP tests or synthetic mouse/key events.
- Preserve the baseline branch and keep every optimization phase independently revertible.
