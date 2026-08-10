import { getSHA } from './git-info'
import { getUpdatesURL, getChannel } from '../script/dist-info'
import { version, productName, companyName } from './package.json'

/**
 * Our GitHub OAuth application.
 *
 * Not a secret: OAuth client IDs are public by design, the device flow
 * transmits this in plaintext, and it is readable from the binary regardless.
 * Committed so development builds work without any environment setup.
 *
 * Upstream's default here was *their* development application
 * ('3a723b10ac5575cc5bb9'), which has neither device flow enabled nor our
 * callback registered -- so a build falling back to it cannot sign in at all.
 *
 * This application must have "Enable Device Flow" ticked. See
 * docs/fork/OAUTH.md.
 */
const forkClientId = 'Ov23liLgD0Eau7Pm4Sag'

/**
 * Retained only for `requestOAuthToken`, which serves the protocol-callback
 * path that the device flow never initiates. There is no client secret for our
 * application, and a public repository could not hold one anyway.
 */
const devClientSecret = ''

const channel = getChannel()

const s = JSON.stringify

const optionalStringReplacement = (value: string | undefined) =>
  value === undefined || value.length === 0 ? 'undefined' : s(value)

export function getReplacements() {
  const isDevBuild = channel === 'development'

  return {
    __OAUTH_CLIENT_ID__: s(process.env.DESKTOP_OAUTH_CLIENT_ID || forkClientId),
    __OAUTH_SECRET__: s(
      process.env.DESKTOP_OAUTH_CLIENT_SECRET || devClientSecret
    ),
    __DARWIN__: process.platform === 'darwin',
    __WIN32__: process.platform === 'win32',
    __LINUX__: process.platform === 'linux',
    __APP_NAME__: s(productName),
    __COMPANY_NAME__: s(companyName),
    __APP_VERSION__: s(version),
    __DEV__: isDevBuild,
    __DEV_SECRETS__: isDevBuild || !process.env.DESKTOP_OAUTH_CLIENT_SECRET,
    __RELEASE_CHANNEL__: s(channel),
    __UPDATES_URL__: s(process.env.DESKTOP_E2E_UPDATES_URL ?? getUpdatesURL()),
    __ERROR_REPORTING_ENDPOINT__: optionalStringReplacement(
      process.env.DESKTOP_ERROR_REPORTING_ENDPOINT
    ),
    __NON_FATAL_ERROR_REPORTING_ENDPOINT__: optionalStringReplacement(
      process.env.DESKTOP_NON_FATAL_ERROR_REPORTING_ENDPOINT
    ),
    __SHA__: s(getSHA()),
    'process.platform': s(process.platform),
    'process.env.NODE_ENV': s(process.env.NODE_ENV || 'development'),
    'process.env.TEST_ENV': s(process.env.TEST_ENV),
  }
}
