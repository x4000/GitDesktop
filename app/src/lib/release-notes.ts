import { readFile } from 'fs/promises'
import * as Path from 'path'
import * as semver from 'semver'
import {
  ReleaseMetadata,
  ReleaseNote,
  ReleaseSummary,
} from '../models/release-notes'
import { getVersion } from '../ui/lib/app-proxy'
import { formatDate } from './format-date'
import { offsetFromNow } from './offset-from'
import { encodePathAsUrl } from './path'
import { getUserAgent } from './http'

// expects a release note entry to contain a header and then some text
// example:
//    [New] Fallback to Gravatar for loading avatars - #821
const itemEntryRe = /^\[([a-z]{1,})\]\s((.|\n)*)/i

function parseEntry(note: string): ReleaseNote | null {
  const text = note.trim()
  const match = itemEntryRe.exec(text)
  if (match === null) {
    log.debug(`[ReleaseNotes] unable to convert text into entry: ${note}`)
    return null
  }

  const kind = match[1].toLowerCase()
  const message = match[2]
  if (
    kind === 'new' ||
    kind === 'fixed' ||
    kind === 'improved' ||
    kind === 'added' ||
    kind === 'pretext' ||
    kind === 'removed'
  ) {
    return { kind, message }
  }

  log.debug(`[ReleaseNotes] kind ${kind} was found but is not a valid entry`)

  return {
    kind: 'other',
    message,
  }
}

/**
 * A filter function with type predicate to return non-null and non-undefined
 * entries while also satisfying the TS compiler
 *
 * Source: https://stackoverflow.com/a/46700791/1363815
 */
function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined
}

export function parseReleaseEntries(
  notes: ReadonlyArray<string>
): ReadonlyArray<ReleaseNote> {
  return notes.map(n => parseEntry(n)).filter(notEmpty)
}

export function getReleaseSummary(
  latestRelease: ReleaseMetadata
): ReleaseSummary {
  const entries = parseReleaseEntries(latestRelease.notes)

  const enhancements = entries.filter(
    e => e.kind === 'new' || e.kind === 'added' || e.kind === 'improved'
  )
  const bugfixes = entries.filter(e => e.kind === 'fixed')
  const other = entries.filter(e => e.kind === 'removed' || e.kind === 'other')
  const thankYous = entries.filter(e => e.message.includes(' Thanks @'))
  const pretext = entries.filter(e => e.kind === 'pretext')

  return {
    latestVersion: latestRelease.version,
    datePublished: formatDate(new Date(latestRelease.pub_date), {
      time: false,
      dateStyle: 'long',
    }),
    pretext,
    enhancements,
    bugfixes,
    other,
    thankYous,
  }
}

export async function getChangeLog(
  limit?: number
): Promise<ReadonlyArray<ReleaseMetadata>> {
  // Served straight from the repository rather than upstream's changelog
  // service, which would show GitHub Desktop's release notes inside this app.
  // No `env` parameter: this fork has a single release channel.
  const changelogURL = new URL(
    'https://raw.githubusercontent.com/x4000/GitDesktop/main/changelog.json'
  )

  if (limit !== undefined) {
    changelogURL.searchParams.set('limit', limit.toString())
  }

  const response = await fetch(changelogURL.toString(), {
    headers: { 'user-agent': getUserAgent() },
  })

  if (!response.ok) {
    return []
  }

  // Upstream fetched this from a service that returned ReleaseMetadata[]
  // already. We serve the repository's own changelog.json, which is the
  // *source* format the release tooling edits:
  //
  //   { "releases": { "2026.8.2": ["[Fixed] ...", ...], ... } }
  //
  // Handing that straight back as an array meant callers did `.filter` on an
  // object and threw. The rejection surfaced as the About dialog sitting on
  // "Checking for updates..." forever, because the handler that consumes this
  // sets its status after awaiting it.
  const body = await response.json()
  const releases: Record<string, ReadonlyArray<string>> = body?.releases ?? {}

  const entries = Object.entries(releases)
    // A key that is not valid semver would throw in the comparisons callers
    // do with it. None exist today; this is so adding one cannot break the
    // update flow.
    .filter(([version]) => semver.valid(version) !== null)
    .sort(([a], [b]) => semver.rcompare(a, b))
    .map(([version, notes]) => ({
      name: version,
      version,
      notes,
      // The source format carries no dates. Callers filter on recency and
      // fall back to the newest release when nothing qualifies, which is the
      // behaviour we want anyway.
      pub_date: '',
    }))

  return limit === undefined ? entries : entries.slice(0, limit)
}

export async function generateReleaseSummary(
  version?: string
): Promise<ReadonlyArray<ReleaseSummary>> {
  const lastTenReleases = await getChangeLog()
  const currentVersion = new semver.SemVer(version ?? getVersion())
  const recentReleases = lastTenReleases.filter(
    r =>
      semver.gt(new semver.SemVer(r.version), currentVersion) &&
      new Date(r.pub_date).getTime() > offsetFromNow(-90, 'days')
  )

  // We should only be pulling release notes when a release just happened, so
  // there should be one within the past 90 days. Thus, this is just precaution
  // to ensure we always show at least the last set of release notes.
  if (recentReleases.length > 0) {
    return recentReleases.map(getReleaseSummary)
  }

  // Upstream indexes [0] unconditionally here, which throws when the changelog
  // could not be fetched at all. Callers await this before updating their own
  // state, so a throw leaves the UI wedged.
  return lastTenReleases.length > 0
    ? [getReleaseSummary(lastTenReleases[0])]
    : []
}

/**
 * This method is used in conjunction with the Help > Show Popup > Release notes
 * menu item to test release notes on dev builds.
 **/
export async function generateDevReleaseSummary(): Promise<
  ReadonlyArray<ReleaseSummary>
> {
  // Remove version if want to use latest version in your dev build
  const releases = [...(await generateReleaseSummary('3.0.0'))]

  const pretextDraft = await readFile(
    Path.join(__dirname, 'static', 'pretext-draft.md'),
    'utf8'
  ).catch(_ => null)

  if (pretextDraft === null) {
    return releases
  }

  return [
    {
      ...releases[0],
      pretext: [{ kind: 'pretext', message: pretextDraft }],
    },
    ...releases.slice(1),
  ]
}

export const ReleaseNoteHeaderLeftUri = encodePathAsUrl(
  __dirname,
  'static/release-note-header-left.svg'
)
export const ReleaseNoteHeaderRightUri = encodePathAsUrl(
  __dirname,
  'static/release-note-header-right.svg'
)
