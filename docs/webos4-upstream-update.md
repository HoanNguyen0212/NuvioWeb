# Updating the customized webOS 4 / Chromium 53 build

## Branch roles

- `webos4-chromium53` is the canonical customized branch. All current webOS 4 fixes must land here.
- `update/upstream-<release>` branches are disposable integration proposals.
- `webos4-chromium53-stable-*` tags are rollback points created only after physical TV acceptance.
- `legacy-webos53-lite` and the RC branches are historical references, not the current release branch.

Never hard-reset `webos4-chromium53` to an upstream tag. An upstream release and this customized build have independent histories; they must be merged and reviewed.

## Automated proposal workflow

`.github/workflows/propose-upstream-update.yml` runs daily and can also be dispatched manually with an upstream tag or branch.

The workflow:

1. Checks out `webos4-chromium53` with full history.
2. Resolves the latest published release from `NuvioMedia/NuvioWeb`, unless a ref was supplied manually.
3. Fetches that ref from the upstream repository.
4. Stops if the upstream commit is already an ancestor of the custom branch.
5. Attempts a merge on `update/upstream-<release>`.
6. Opens or refreshes a pull request when the merge is clean.
7. Opens an issue containing only the conflicting file names when manual conflict resolution is required.

The workflow never pushes directly to the canonical branch and never handles private runtime values.

## Required CI gates

Pushes and pull requests for `webos4-chromium53` run both legacy workflows. Before an update can be accepted, CI must pass:

- the immutable webOS 4 / Chromium 53 policy check;
- Node tests;
- source lint;
- placeholder-only runtime generation;
- the Chrome 53 chunked build;
- Acorn ECMAScript 2016 parsing of every emitted JS file;
- overlay/load-order/package checks;
- startup and total bundle-size ceilings;
- IPK packaging and checksum/report generation.

A public Actions IPK contains placeholders and is deliberately unfit for installation.

## Manual conflict resolution

When the proposal workflow reports conflicts, use a separate worktree so the known-working checkout stays untouched:

```bash
git fetch upstream --tags
git fetch origin webos4-chromium53
TAG=0.3.26-beta
BRANCH="update/upstream-${TAG}"
WORKTREE="../NuvioWeb-${TAG}-update"

git worktree add -b "$BRANCH" "$WORKTREE" origin/webos4-chromium53
cd "$WORKTREE"
git merge --no-ff "$TAG"
```

Resolve conflicts by preserving both the new upstream behavior and these invariants:

- `webOsRequiredVersion: "4.0.0"`;
- `chromiumVersion: 53` and `webOsChromiumVersion: 53`;
- transpilation of every app, vendor, and route chunk;
- legacy polyfill, fast-home, and performance overlay package order;
- no private values in commits or public artifacts;
- route chunking and bundle-size limits;
- Magic Remote focus/activation behavior;
- custom boot, Cloud sync, and stream-filtering behavior.

Then run:

```bash
npm ci
npm run verify:webos53-policy
npm test
npm run lint
node scripts/create-placeholder-properties.mjs
NUVIO_REQUIRE_LOCAL_PROPERTIES=1 NUVIO_BUILD_METAFILE=1 npm run package:webos
node scripts/analyze-legacy-bundle.mjs
node scripts/verify-legacy-webos-package.mjs
git diff --check
```

Push the update branch and open a PR against `webos4-chromium53`. Do not overwrite the canonical branch with a force push.

## Private candidate and TV acceptance

After public CI passes:

1. Download the placeholder candidate.
2. Inject the existing private runtime environment offline.
3. Keep the private IPK at mode `600` and calculate SHA-256.
4. Back up the currently deployed app and preserve the latest stable IPK.
5. Install on the rooted TV.
6. Test every lazy route at least once: Home, Search, Detail, Stream, Player, Settings, Library, See All, profile/auth, folders, cast, plugin/addon remote.
7. Test HLS/DASH playback, subtitles, seek, audio sync, Cloud addon sync, stream filtering, D-pad, Enter hold/keyup, and Magic Remote pointer activation.
8. Measure cold boot and first usable Home focus.
9. Only after physical acceptance, merge the PR and create a new annotated stable tag.

If acceptance fails, restore the previous stable tag/private IPK; do not repair the canonical branch directly on the TV and then forget to commit the source change.
