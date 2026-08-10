import { Emitter, Disposable } from 'event-kit'
import { getNumberArray, setNumberArray } from '../local-storage'

/**
 * Repositories the user has pinned to the top of the repository list.
 *
 * Kept here rather than in AppStore for the same reason as the sidebar width:
 * AppStore is upstream's hottest file and everything added to it is hand-merged
 * monthly. This is self-contained state with no bearing on anything else, so it
 * does not need to live there. See docs/fork/MERGING.md.
 *
 * Keyed on `Repository.id`, the local database row id. That is stable for the
 * lifetime of an install but means pins do not follow a repository that is
 * removed and re-added -- an acceptable trade for not having to invent a
 * durable identity for repositories that may have no remote at all.
 */

const StorageKey = 'fork-pinned-repositories'

const emitter = new Emitter()
const PinsChangedEvent = 'pins-changed'

let cache: ReadonlySet<number> | null = null

const load = (): ReadonlySet<number> => {
  cache ??= new Set(getNumberArray(StorageKey))
  return cache
}

/** Ids of every pinned repository. */
export const getPinnedRepositoryIds = (): ReadonlySet<number> => load()

export const isRepositoryPinned = (id: number): boolean => load().has(id)

/** Pin or unpin a repository, persisting immediately. */
export function setRepositoryPinned(id: number, pinned: boolean) {
  const current = new Set(load())

  if (pinned === current.has(id)) {
    return
  }

  if (pinned) {
    current.add(id)
  } else {
    current.delete(id)
  }

  cache = current
  setNumberArray(StorageKey, [...current])
  emitter.emit(PinsChangedEvent, undefined)
}

/**
 * Subscribe to pin changes.
 *
 * The repository list is rendered from props that AppStore owns, and AppStore
 * knows nothing about pins, so nothing re-renders on its own when a pin
 * changes. Consumers subscribe and force an update.
 */
export function onPinnedRepositoriesChanged(fn: () => void): Disposable {
  return emitter.on(PinsChangedEvent, fn)
}
