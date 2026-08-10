# Merging from upstream

This fork tracks [desktop/desktop](https://github.com/desktop/desktop). Upstream
is active — roughly 1,700 commits a year — so the fork is built around keeping
our diff small and predictable rather than trying to keep up with everything.

## One-time setup per clone

```bash
yarn fork:setup
```

This registers the `ours` merge driver referenced by `.gitattributes` and turns
on `rerere`. Neither can be committed to the repository, so a fresh clone
without this step will hand you conflicts in files we own outright.

## Taking a new upstream release

```bash
git fetch upstream --tags
git merge upstream/development
```

Merge, don't rebase. Rebasing replays our whole patch set against a moving
target every time and throws away `rerere`'s recorded resolutions.

Do this at upstream's release tags, roughly monthly. Continuous merging means
fighting half-finished refactors; annual merging means an unmergeable wall.

## The three zones

**Fork-owned** — we keep our version, always. Marked `merge=ours` in
`.gitattributes`, so git resolves these without asking:

- `.github/workflows/release.yml`
- `.github/workflows/draft-release.yml`, `.github/workflows/release-pr.yml`
  (stubs — see below)
- `script/fork/**`, `docs/fork/**`, `app/src/ui/fork/**`

Two of these are deliberately kept as disabled stubs rather than deleted. A
deleted file produces a modify/delete conflict every time upstream touches it,
and `merge=ours` does not apply to files missing on our side. A stub costs
nothing and conflicts never.

`script/draft-release/` **is** deleted outright. Upstream touches it about five
times a year; resolve those with `git rm` and move on.

**Contested** — hand-merged, and where all the real work is:

| File | Why we touch it |
| --- | --- |
| `app/src/ui/app.tsx` | Sidebar hook points |
| `app/src/lib/api.ts` | Endpoint plumbing, device-flow auth |
| `script/dist-info.ts` | Update feed URL, channel, asset naming |
| `script/package.ts` | Windows packaging, RELEASES rewrite |
| `script/build.ts` | Protocol schemes |
| `app/package.json` | Product identity, version |

`app.tsx` is the one that matters — it is the single hottest file upstream
(59 commits in the last six months) and it is where our sidebar changes live.

**Upstream** — everything else. Take theirs. If something outside the table
above conflicts, that is the signal our diff has grown beyond its intended
shape.

## What a merge actually costs

Measured, not guessed. Our diff was replayed onto an upstream base from 30 days
earlier — 90 upstream commits of drift, touching 10 of the 51 files we modify —
to see what collides:

| File | Conflict |
| --- | --- |
| `app/package.json` | Our identity block against their version bump |
| `script/build.ts` | Their icon-resolution rewrite against our `extraResource` |
| `app/src/ui/preferences/copilot.tsx` | Both sides added an import |
| `.gitattributes` | Both sides appended a line |

**Four conflicts, all trivial** — none needed more than picking both sides or
keeping ours. A month of upstream drift is minutes of work, not hours.

Two things to expect on a real merge:

- `app/package.json` conflicts **every time** upstream bumps the version,
  because our identity block sits in the same hunk. Resolve by keeping our
  identity and taking their version number. `rerere` learns this one after the
  first time.
- Upstream is actively changing icon handling in `script/build.ts`. Our
  `Assets.car` change (see [ICONS.md](ICONS.md)) sits right where they are
  working, so re-read that hunk rather than resolving it mechanically.

To repeat this measurement before a big merge:

```bash
git diff --binary upstream/development..main -- . ':(exclude)app/static/logos' > /tmp/fork.patch
git checkout -b merge-sim $(git rev-list -1 --before="30 days ago" upstream/development)
git apply -3 /tmp/fork.patch    # conflicts here are what a month of drift costs
```

Exclude `app/static/logos` — those are generated binaries, and rewinding past
their introduction fails for reasons a forward merge never hits.

## The rule that keeps this cheap

New files never conflict. Edited files do.

Sidebar behaviour belongs in `app/src/ui/fork/`, and the diff inside `app.tsx`
should be as close as possible to **one line per hook point** — swapping a
binding such as `dropdownContentRenderer={this.renderRepositoryList}` to point
at our component, rather than rewriting the method body in place.

A one-line change in a hot file conflicts rarely and resolves in seconds. A
rewritten 150-line render method conflicts on almost every merge. Resist
cleaning up surrounding code while you are in there — every extra line in a
contested file is rent paid monthly, forever.
