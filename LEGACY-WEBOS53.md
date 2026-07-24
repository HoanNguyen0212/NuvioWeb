# Legacy LG webOS / Chromium 53 branch

This branch is an experimental compatibility and performance port for a rooted LG TV running Chromium 53.

## Safety status

**Do not install artifacts from the analysis workflow.** The first workflow produces bundle reports only. It does not yet contain the complete, verified TV overlay or a release IPK.

## Build policy

- JavaScript target: Chrome 53
- Runtime gate: Chromium 53
- webOS package requirement: 4.0.0
- webOS service target: Node 8 (unchanged)
- No account, cloud, addon, or runtime secrets are committed or uploaded

## Planned stages

1. Measure the monolithic startup bundle with an esbuild metafile.
2. Port the existing polyfills, boot guard, legacy CSS, and exact script order into the source build/package pipeline.
3. Split non-Home routes from the startup path without relying on ES modules or dynamic `import()`.
4. Add bounded Home rendering and index-based focus navigation.
5. Package an IPK only after static checks pass; then test it on the TV with a complete rollback snapshot.

The official release package remains a comparison artifact. A direct Homebrew update is not safe for this TV.
