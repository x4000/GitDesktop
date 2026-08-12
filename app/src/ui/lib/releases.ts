import { getRepositorySlug } from '../../../package-info'

/**
 * Where "release notes" links go.
 *
 * Upstream points at desktop.github.com, which documents GitHub Desktop's
 * releases -- not ours. Derived from the repository in app/package.json so it
 * tracks the same source of truth as the update feed rather than being a
 * second place to remember to change.
 *
 * Upstream also varied this by release channel; this fork has one channel.
 */
export const ReleaseNotesUri = `https://github.com/${getRepositorySlug()}/releases`
