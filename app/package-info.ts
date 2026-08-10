import {
  bundleID,
  companyName,
  productName,
  repository,
  version,
} from './package.json'

export function getProductName() {
  return process.env.NODE_ENV === 'development'
    ? `${productName}-dev`
    : productName
}

export function getCompanyName() {
  return companyName
}

export function getVersion() {
  return version
}

export function getBundleID() {
  return process.env.NODE_ENV === 'development' ? `${bundleID}Dev` : bundleID
}

/**
 * The `owner/repo` slug this fork is published from, derived from the
 * `repository` field in app/package.json so there is exactly one place to
 * change it.
 *
 * Used to build the auto-update feed URL (see `getUpdatesURL` in
 * script/dist-info.ts). Only meaningful at build time.
 */
export function getRepositorySlug() {
  const match = /github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/.exec(repository.url)

  if (match === null) {
    throw new Error(
      `Unable to derive an owner/repo slug from the 'repository.url' field in ` +
        `app/package.json ('${repository.url}'). The auto-update feed URL is ` +
        `built from this value, so it must point at the GitHub repository ` +
        `releases are published to.`
    )
  }

  const [, owner, repo] = match
  return `${owner}/${repo}`
}
