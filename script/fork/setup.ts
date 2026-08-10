/**
 * One-time (per clone) git configuration for this fork.
 *
 * Two things cannot be committed to a repository and therefore have to be set
 * up in every working copy:
 *
 *  1. The "ours" merge driver referenced by .gitattributes. Without it git
 *     silently ignores the `merge=ours` attributes and you hand-resolve
 *     conflicts in files we own outright.
 *  2. rerere, which records how you resolved a conflict and replays that
 *     resolution the next time the same conflict shows up. This is what makes
 *     repeated merges of app.tsx tolerable.
 *
 * Run via `yarn fork:setup`.
 */

import { execFileSync } from 'child_process'

const UPSTREAM_REMOTE = 'upstream'
const UPSTREAM_URL = 'https://github.com/desktop/desktop.git'

const git = (...args: ReadonlyArray<string>) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim()

const trySetConfig = (key: string, value: string) => {
  const existing = (() => {
    try {
      return git('config', '--local', '--get', key)
    } catch {
      return undefined
    }
  })()

  if (existing === value) {
    console.log(`  ✓ ${key} already set to ${value}`)
    return
  }

  git('config', '--local', key, value)
  console.log(`  ✓ ${key} = ${value}`)
}

const hasRemote = (name: string) => {
  try {
    git('remote', 'get-url', name)
    return true
  } catch {
    return false
  }
}

console.log('Configuring fork merge tooling…')

// Makes `merge=ours` in .gitattributes actually do something. `true` is the
// no-op command: it succeeds without touching the working tree, which git
// interprets as "the current (ours) version is the resolution".
trySetConfig('merge.ours.driver', 'true')

// Record and replay conflict resolutions across merges.
trySetConfig('rerere.enabled', 'true')
trySetConfig('rerere.autoupdate', 'true')

if (!hasRemote(UPSTREAM_REMOTE)) {
  console.log(`Adding '${UPSTREAM_REMOTE}' remote → ${UPSTREAM_URL}`)
  git('remote', 'add', UPSTREAM_REMOTE, UPSTREAM_URL)
  console.log(`  ✓ ${UPSTREAM_REMOTE} added`)
} else {
  console.log(`  ✓ '${UPSTREAM_REMOTE}' remote already present`)
}

console.log(`
Done. To take a new upstream release:

  git fetch upstream --tags
  git merge <upstream tag or upstream/development>

Conflicts should be limited to the "contested" files listed in
docs/fork/MERGING.md. Anything else conflicting means our diff has grown --
push it back into app/src/ui/fork/ instead of resolving in place.
`)
