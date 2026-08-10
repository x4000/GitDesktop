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
