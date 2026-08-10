/**
 * Gitea support for this fork.
 *
 * Upstream models exactly three kinds of endpoint: github.com, ghe.com, and
 * "GitHub Enterprise Server", where the last one is defined by exclusion --
 * `isGHES = !isDotCom && !isGHE`. That default is the problem: an unrecognised
 * host is *assumed* to be GHES, so a Gitea instance would inherit every GHES
 * capability and the app would call APIs that do not exist.
 *
 * So Gitea has to be a first-class endpoint kind, recognised before the GHES
 * fallback gets a chance to claim it.
 */

/** The API path prefix Gitea serves. GitHub Enterprise Server uses /api/v3. */
export const GiteaAPIPath = '/api/v1'

/** A Gitea instance we have registered an OAuth application on. */
export interface IKnownGiteaInstance {
  /** Origin of the instance, no trailing slash. e.g. https://git.example.com */
  readonly origin: string

  /**
   * OAuth client ID issued by this instance.
   *
   * Not a secret -- OAuth client IDs are public by design, and this one belongs
   * to a public (PKCE) client, so there is no client secret to accompany it.
   * See docs/fork/OAUTH.md.
   *
   * Client IDs are per-instance, which is why this is a list rather than a
   * build-time constant the way the GitHub one is.
   */
  readonly oauthClientId: string
}

export const KnownGiteaInstances: ReadonlyArray<IKnownGiteaInstance> = [
  {
    origin: 'https://git.arcengames.com',
    oauthClientId: '6ae0a048-e223-4fd1-b924-8d9848b63c2c',
  },
]

/** Storage key for a learned endpoint kind. Mirrors the GHES version cache. */
const endpointKindKey = (ep: string) => `endpoint-kind:${normalizeOrigin(ep)}`

const kindCache = new Map<string, EndpointKind>()

/**
 * localStorage is renderer-only, but this module is reachable from the main
 * process through the api/http module graph. Touching it unguarded there is a
 * crash, so both accessors degrade to the in-memory cache instead.
 */
function safeLocalStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

export type EndpointKind = 'gitea' | 'github'

/**
 * Reduce any endpoint-ish string to a bare origin so that the API URL, the HTML
 * URL, and a user-typed address with a trailing slash all agree.
 */
export function normalizeOrigin(endpointOrURL: string): string {
  try {
    return new URL(endpointOrURL).origin.toLowerCase()
  } catch {
    return endpointOrURL.replace(/\/+$/, '').toLowerCase()
  }
}

/** The known instance matching this endpoint, API URL, or HTML URL, if any. */
export function getKnownGiteaInstance(
  endpointOrURL: string
): IKnownGiteaInstance | undefined {
  const origin = normalizeOrigin(endpointOrURL)
  return KnownGiteaInstances.find(i => normalizeOrigin(i.origin) === origin)
}

/**
 * Record that an endpoint is (or is not) Gitea.
 *
 * Detection cannot be done from the endpoint string alone for an arbitrary
 * host, and unlike GitHub Enterprise Server -- which advertises itself with an
 * `x-github-enterprise-version` response header -- Gitea sends no version
 * header we can sniff. So the kind is established once, when the user adds the
 * account, and persisted the same way endpoint versions are.
 */
export function setEndpointKind(endpoint: string, kind: EndpointKind) {
  const key = endpointKindKey(endpoint)
  if (kindCache.get(key) !== kind) {
    kindCache.set(key, kind)
    safeLocalStorage()?.setItem(key, kind)
  }
}

/**
 * Whether the endpoint is known to be a Gitea instance.
 *
 * Known instances answer without any stored state, so a fresh install
 * recognises them before the user has signed in to anything.
 */
export function isGitea(endpoint: string): boolean {
  if (getKnownGiteaInstance(endpoint) !== undefined) {
    return true
  }

  const key = endpointKindKey(endpoint)
  const cached = kindCache.get(key)

  if (cached !== undefined) {
    return cached === 'gitea'
  }

  const stored = safeLocalStorage()?.getItem(key)

  if (stored === 'gitea' || stored === 'github') {
    kindCache.set(key, stored)
    return stored === 'gitea'
  }

  return false
}

/**
 * Probe an unknown host to see whether it is running Gitea.
 *
 * `/api/v1/version` is unauthenticated and Gitea-specific; GitHub Enterprise
 * Server has no such route. Used when a user adds an account on an instance
 * that is not in `KnownGiteaInstances`.
 *
 * Returns undefined when the probe cannot reach the host, which is deliberately
 * distinct from "definitely not Gitea" -- callers should not persist a negative
 * result they are not sure about.
 */
export async function probeIsGitea(
  htmlURL: string
): Promise<boolean | undefined> {
  const url = new URL(`${GiteaAPIPath}/version`, normalizeOrigin(htmlURL) + '/')

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      return false
    }

    // Shape is { "version": "1.22.0" }. We only care that it parses and has a
    // version -- any other JSON body means we are talking to something else.
    const body = await response.json()
    return typeof body?.version === 'string'
  } catch (e) {
    log.warn(`probeIsGitea: could not reach ${url}`, e)
    return undefined
  }
}
