# GitDesktop

A fork of [GitHub Desktop](https://github.com/desktop/desktop) maintained by
Arcen Games, LLC, with two changes from upstream:

1. A sidebar reworked around our team's workflow.
2. First-class [Gitea](https://about.gitea.com/) support, replacing hardcoded
   assumptions that the remote is GitHub.

Everything else tracks upstream and is merged in periodically. This is not a
general-purpose replacement for GitHub Desktop — if you are not on our team,
you almost certainly want [the original](https://desktop.github.com/).

> **Status: early.** The release, update, and branding pipeline is in place, and
> Gitea sign-in works — signing in with a personal access token, listing
> repositories, and fetching are all verified against a real instance. The
> sidebar rework has not been started, and GitHub sign-in still runs through
> upstream's development OAuth application, which is not shippable.

## Installing

Download the latest installer from [Releases](https://github.com/x4000/GitDesktop/releases).

**Windows** updates automatically. Builds are unsigned, so the first run shows a
SmartScreen warning — choose "More info" then "Run anyway".

**macOS** is manual-install only. We do not sign or notarize, and macOS refuses
to auto-update an unsigned app, so macOS builds are published as workflow
artifacts rather than release assets. See
[docs/fork/RELEASING.md](docs/fork/RELEASING.md).

## Relationship to upstream

Upstream is active — around 1,700 commits a year — so this fork is deliberately
built to keep its diff small: new behaviour lives in its own files, and edits to
upstream files are kept to the minimum number of lines that will do the job.

- [docs/fork/MERGING.md](docs/fork/MERGING.md) — how to merge from upstream, and
  which files are ours versus theirs. **Read this before your first merge**;
  there is a one-time `yarn fork:setup` step per clone.
- [docs/fork/ICONS.md](docs/fork/ICONS.md) — regenerating branding assets.

## Building

On Windows, double-click **`run-dev.cmd`**. It installs dependencies if needed,
rebuilds only when main-process code has changed, and launches the dev app.

Renderer changes hot-reload while it runs, so you rarely need to restart. Main
process changes do need a rebuild, which it detects by timestamp — pass
`-Rebuild` to force one, or `-NoBuild` to skip straight to launching.

The dev build has a teal icon and is named `GitDesktop-dev`, so it will not
collide with an installed GitHub Desktop or a release build.

Full build instructions are upstream's and still apply:
[docs/contributing/setup.md](./docs/contributing/setup.md).

After cloning, run this once to configure the merge tooling:

```bash
yarn fork:setup
```

## Reporting problems

Open an issue [here](https://github.com/x4000/GitDesktop/issues) for anything
specific to this fork.

Please do **not** report issues to
[desktop/desktop](https://github.com/desktop/desktop) that you have only seen in
this fork — reproduce them against an official GitHub Desktop build first.

## License

**[MIT](LICENSE)**, inherited from GitHub Desktop. The copyright notice in
`LICENSE` names GitHub, Inc. and is retained as the license requires.

The MIT grant does not extend to GitHub's trademarks, which include the logo
designs. GitHub reserves all trademark and copyright rights in and to all GitHub
trademarks. GitHub® and its stylized versions and the Invertocat mark are
GitHub's Trademarks or registered Trademarks.

This fork ships its own icon and does not include GitHub's logo assets. It is
not affiliated with, endorsed by, or supported by GitHub, Inc.
