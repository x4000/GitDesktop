# Releasing

One channel, one workflow. Bump the version, tag it, push the tag.

```bash
# 1. Bump "version" in app/package.json, commit it.
# 2. Tag with PLAIN SEMVER and push:
git tag 3.6.5
git push origin 3.6.5
```

[`.github/workflows/release.yml`](../../.github/workflows/release.yml) does the
rest: builds Windows and macOS on both architectures, merges the per-arch
Squirrel `RELEASES` files, checks the asset names, and publishes a GitHub
Release.

## Rules the update feed imposes

Auto-update is served by [update.electronjs.org](https://github.com/electron/update.electronjs.org),
which reads this repository's GitHub Releases. It is strict, and it fails
silently — a mistake here means clients quietly stop updating rather than
erroring. Hence:

- **Tags must be plain semver.** `3.6.5` or `v3.6.5`. The service runs
  `semver.valid()` on the tag name, so upstream's `release-3.6.5` convention
  produces a release the feed ignores. The workflow's tag filter enforces this.
- **No drafts, no prereleases.** The service skips both. This is why there is no
  beta channel; pre-release testing happens from CI build artifacts instead.
- **The tag must match `app/package.json`.** The workflow fails the build if it
  does not. A mismatch means clients either never see the update or download it
  forever.
- **Asset filenames are load-bearing.** The service matches macOS on
  `/.*-(mac|darwin|osx).*\.zip$/` and Windows on `/.*-win32-(ia32|x64|arm64).*/`.
  `script/dist-info.ts` produces names that satisfy this and explains why in
  comments. The release job verifies them before publishing.

## macOS

**Releases are Windows-only.** macOS is not in the build matrix at all.

Two reasons. macOS builds are unsigned, and Squirrel.Mac will not apply an
update to an unsigned app, so publishing a macOS zip would offer Mac users an
update that fails on install and re-downloads on the next check. And upstream's
matrix builds macOS on `macos-14-xlarge`, a *larger* runner, which GitHub bills
even for public repositories — the first release attempt failed there on
billing before Windows had started.

Building macOS only to withhold the result was paying for artifacts we discard.

To enable macOS: obtain an Apple Developer account ($99/year), add the
`APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_APPLICATION_CERT`, and
`APPLE_APPLICATION_CERT_PASSWORD` secrets, restore them to the build step, add a
`macos-14` entry to the matrix, and set `PUBLISH_MACOS: 'true'`.

Use `macos-14` rather than upstream's `macos-14-xlarge` — the standard runner is
free for public repositories. It is Apple Silicon, so an x64 build needs
`macos-13` or cross-compilation via `npm_config_arch`.

### Note on ci.yml

Upstream's `ci.yml` also uses `macos-14-xlarge`. It does not run on pushes to
`main` (it watches `development`), but it *does* run on pull requests, and will
fail there on billing for the same reason. Left alone for now: it is an upstream
file we would rather not carry a diff in until it actually gets in the way.

## Windows signing

Windows builds are unsigned, which triggers a SmartScreen warning on first run.
The service does not require signing for Windows, so updates work regardless. To
sign, set `options.signWithParams` in `script/package.ts` — upstream's Azure
Code Signing block was removed because it referenced GitHub's own certificate
profile.

## Testing the pipeline

Run the workflow manually (`workflow_dispatch`) to build and upload artifacts
without publishing anything. The release job only runs on a tag push.
