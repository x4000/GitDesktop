import { Account } from '../models/account'

/** Get the auth key for the user. */
export function getKeyForAccount(account: Account): string {
  return getKeyForEndpoint(account.endpoint)
}

/** Get the auth key for the endpoint. */
export function getKeyForEndpoint(endpoint: string): string {
  // This is the credential-store key. Upstream uses the bare name 'GitHub',
  // so keeping it would mean this fork and an installed GitHub Desktop share
  // one entry per endpoint -- each overwriting the other's token. Namespacing
  // by our own app name keeps the two independent.
  const appName = __DEV__ ? `${__APP_NAME__} Dev` : __APP_NAME__

  return `${appName} - ${endpoint}`
}
