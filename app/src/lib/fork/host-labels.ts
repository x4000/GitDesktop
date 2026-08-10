import { isDotCom, isGHE, isGitea } from '../endpoint-capabilities'

/**
 * Human-readable names for the service behind an endpoint.
 *
 * Upstream hardcodes "GitHub" in menu labels and "GitHub Enterprise" in the
 * two commit context menus, on the assumption that those are the only two
 * things an endpoint can be. A Gitea repository ends up labelled "View on
 * GitHub", which sends the user somewhere GitHub does not host.
 */

/** e.g. "GitHub", "Gitea", "GitHub Enterprise". */
export function getHostDisplayName(endpoint: string | null): string {
  if (endpoint === null) {
    // No API endpoint means the repository is not associated with a forge at
    // all. Callers generally hide the action entirely in that case; "the web"
    // is the honest fallback if one does render it.
    return 'the web'
  }

  if (isDotCom(endpoint)) {
    return 'GitHub'
  }

  if (isGitea(endpoint)) {
    return 'Gitea'
  }

  if (isGHE(endpoint)) {
    return 'GitHub'
  }

  return 'GitHub Enterprise'
}

/** Label for the "view this on the forge's website" action. */
export const getViewOnHostLabel = (endpoint: string | null) =>
  `View on ${getHostDisplayName(endpoint)}`

/**
 * The same label for the application menu, which is built in the main process
 * before any repository is selected.
 *
 * `null` yields the neutral "View on Web" rather than naming a service,
 * because at that point we genuinely do not know which one it will be.
 */
export const getViewOnHostMenuLabel = (endpoint: string | null) =>
  endpoint === null ? 'View on Web' : getViewOnHostLabel(endpoint)
