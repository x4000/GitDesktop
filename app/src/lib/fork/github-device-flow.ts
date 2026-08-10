import { request, parsedResponse } from '../http'
import { getHTMLURL } from '../api'

/**
 * OAuth device flow for GitHub.
 *
 * Upstream uses the authorization-code flow: it opens a browser and waits for
 * GitHub to redirect back to a custom protocol registered by the app. That
 * cannot work here for two reasons. The redirect target is configured on the
 * OAuth application, so it points at upstream's `x-github-desktop-auth://`
 * scheme, which this fork deliberately does not register -- claiming it would
 * fight an installed GitHub Desktop for the callback. And the code exchange
 * needs a client secret, which a public repository cannot keep.
 *
 * The device flow has neither problem: no redirect, and no secret. The user is
 * shown a short code, types it at github.com/login/device, and the app polls
 * until GitHub hands over a token.
 *
 * The OAuth application must have "Enable Device Flow" ticked. See
 * docs/fork/OAUTH.md.
 */

/** GitHub's fixed grant type identifier for the device flow. */
const DeviceGrantType = 'urn:ietf:params:oauth:grant-type:device_code'

export interface IDeviceFlowStart {
  /** The code to show the user, e.g. "WDJB-MJHT". */
  readonly userCode: string

  /** Where the user enters that code. */
  readonly verificationUri: string

  /** Opaque handle used when polling. Not shown to the user. */
  readonly deviceCode: string

  /** Seconds to wait between polls, as dictated by the server. */
  readonly interval: number

  /** Seconds until `deviceCode` stops being accepted. */
  readonly expiresIn: number
}

interface IAPIDeviceCodeResponse {
  readonly device_code: string
  readonly user_code: string
  readonly verification_uri: string
  readonly expires_in: number
  readonly interval: number
}

interface IAPIDeviceTokenResponse {
  readonly access_token?: string
  readonly error?: string
  readonly error_description?: string
}

/**
 * Ask GitHub for a device code and the code to show the user.
 *
 * `endpoint` is the API endpoint; the device flow lives on the HTML host.
 */
export async function requestDeviceCode(
  endpoint: string,
  clientId: string,
  scopes: ReadonlyArray<string>
): Promise<IDeviceFlowStart> {
  const response = await request(
    getHTMLURL(endpoint),
    null,
    'POST',
    'login/device/code',
    { client_id: clientId, scope: scopes.join(' ') }
  )

  if (!response.ok) {
    // GitHub puts the actual reason in the body -- `device_flow_disabled` when
    // the application has not enabled it, `incorrect_client_credentials` for a
    // bad client id. Reporting only the status code turns a one-line fix into
    // a guessing game.
    const detail = await response
      .text()
      .then(t => t.slice(0, 300))
      .catch(() => '')

    throw new Error(
      `Could not start sign in (HTTP ${response.status}).${
        detail ? ` ${detail}` : ''
      } If the application has not enabled device flow, tick "Enable Device Flow" on the OAuth app.`
    )
  }

  const body = await parsedResponse<IAPIDeviceCodeResponse>(response)

  if (!body.device_code || !body.user_code) {
    throw new Error('GitHub did not return a device code.')
  }

  return {
    deviceCode: body.device_code,
    userCode: body.user_code,
    verificationUri: body.verification_uri,
    // The spec says to default to 5 seconds when the server omits an interval.
    interval: body.interval > 0 ? body.interval : 5,
    expiresIn: body.expires_in > 0 ? body.expires_in : 900,
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    const onAbort = () => {
      clearTimeout(timer)
      reject(new Error('cancelled'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })

/**
 * Poll until the user completes (or refuses) authorization.
 *
 * Resolves with an access token, or throws. Polling stops when `signal` is
 * aborted, so abandoning a sign-in does not leave a request loop running.
 */
export async function pollForDeviceToken(
  endpoint: string,
  clientId: string,
  start: IDeviceFlowStart,
  signal?: AbortSignal
): Promise<string> {
  const htmlURL = getHTMLURL(endpoint)
  const deadline = Date.now() + start.expiresIn * 1000

  // Mutable: the server can tell us to back off, and the spec requires that we
  // obey rather than keep polling at the original rate.
  let intervalMs = start.interval * 1000

  while (!signal?.aborted) {
    await sleep(intervalMs, signal)

    if (Date.now() > deadline) {
      throw new Error(
        'The sign in code expired before it was used. Please try again.'
      )
    }

    const response = await request(
      htmlURL,
      null,
      'POST',
      'login/oauth/access_token',
      {
        client_id: clientId,
        device_code: start.deviceCode,
        grant_type: DeviceGrantType,
      }
    )

    const body = await parsedResponse<IAPIDeviceTokenResponse>(response)

    if (body.access_token) {
      return body.access_token
    }

    switch (body.error) {
      // The user has not finished entering the code. This is the normal case
      // for most of the poll loop, not a failure.
      case 'authorization_pending':
        break

      // We polled too fast. The spec requires increasing the interval; GitHub
      // does not always say by how much, so add the conventional 5s.
      case 'slow_down':
        intervalMs += 5000
        break

      case 'expired_token':
        throw new Error(
          'The sign in code expired before it was used. Please try again.'
        )

      case 'access_denied':
        throw new Error('Sign in was cancelled from the browser.')

      default:
        throw new Error(
          body.error_description ??
            `Sign in failed${body.error ? `: ${body.error}` : ''}.`
        )
    }
  }

  throw new Error('cancelled')
}
