import * as Path from 'path'
import * as Fs from 'fs'

import {
  getProductName,
  getRepositorySlug,
  getVersion,
} from '../app/package-info'
import { join } from 'path'

const productName = getProductName()
const version = getVersion()

const projectRoot = Path.join(__dirname, '..')

export function getDistRoot() {
  return Path.join(projectRoot, 'dist')
}

export function getDistPath() {
  return Path.join(
    getDistRoot(),
    `${getExecutableName()}-${process.platform}-${getDistArchitecture()}`
  )
}

export function getExecutableName() {
  const suffix = process.env.NODE_ENV === 'development' ? '-dev' : ''

  if (process.platform === 'win32') {
    return `${getWindowsIdentifierName()}${suffix}`
  } else if (process.platform === 'linux') {
    return 'desktop'
  } else {
    return productName
  }
}

export function getOSXZipName() {
  // The 'darwin' infix is not cosmetic: update.electronjs.org only recognises
  // a macOS asset if the filename matches /.*-(mac|darwin|osx).*\.zip$/, and
  // picks arm64 by the presence of '-arm64'. Renaming this breaks auto-update
  // silently -- the feed returns 204 and the app just never updates.
  return `${productName}-darwin-${getDistArchitecture()}.zip`
}

export function getOSXZipPath() {
  return Path.join(getDistPath(), '..', getOSXZipName())
}

export function getWindowsInstallerName() {
  const productName = getExecutableName()
  return `${productName}Setup-${getDistArchitecture()}.msi`
}

export function getWindowsInstallerPath() {
  return Path.join(getDistPath(), '..', 'installer', getWindowsInstallerName())
}

export function getWindowsStandaloneName() {
  const productName = getExecutableName()
  // As with getOSXZipName, the '-win32-<arch>' infix is what makes
  // update.electronjs.org resolve the architecture. Its legacy '.exe' fallback
  // only covers x64 and explicitly rejects names containing 'arm', so an
  // arm64 installer without the infix is ignored by the feed entirely.
  return `${productName}Setup-win32-${getDistArchitecture()}.exe`
}

export function getWindowsStandalonePath() {
  return Path.join(getDistPath(), '..', 'installer', getWindowsStandaloneName())
}

export function getWindowsFullNugetPackageName(
  includeArchitecture: boolean = false
) {
  const architectureInfix = includeArchitecture
    ? `-${getDistArchitecture()}`
    : ''
  return `${getWindowsIdentifierName()}-${version}${architectureInfix}-full.nupkg`
}

export function getWindowsFullNugetPackagePath() {
  return Path.join(
    getDistPath(),
    '..',
    'installer',
    getWindowsFullNugetPackageName()
  )
}

export function getWindowsDeltaNugetPackageName(
  includeArchitecture: boolean = false
) {
  const architectureInfix = includeArchitecture
    ? `-${getDistArchitecture()}`
    : ''
  return `${getWindowsIdentifierName()}-${version}${architectureInfix}-delta.nupkg`
}

export function getWindowsDeltaNugetPackagePath() {
  return Path.join(
    getDistPath(),
    '..',
    'installer',
    getWindowsDeltaNugetPackageName()
  )
}

export function getWindowsIdentifierName() {
  // Fork identity. This is the Squirrel package name and therefore also the
  // install directory (%LOCALAPPDATA%\<name>) and the executable name. It MUST
  // differ from upstream's 'GitHubDesktop' or installing this fork will fight
  // with an installed GitHub Desktop over the same directory.
  return 'GitDesktop'
}

export function getBundleSizes() {
  const outPath = Path.join(projectRoot, 'out')
  return {
    // eslint-disable-next-line no-sync
    rendererBundleSize: Fs.statSync(Path.join(outPath, 'renderer.js')).size,
    // eslint-disable-next-line no-sync
    mainBundleSize: Fs.statSync(Path.join(outPath, 'main.js')).size,
  }
}
export const isPublishable = () => getChannel() === 'production'

/**
 * This fork ships a single release channel. Upstream has production/beta/test;
 * update.electronjs.org skips draft and prerelease GitHub Releases outright, so
 * there is nothing for a second channel to point at. Pre-release testing is
 * done from CI build artifacts instead of over the update feed.
 */
export const getChannel = () =>
  process.env.RELEASE_CHANNEL ?? process.env.NODE_ENV ?? 'development'

export function getDistArchitecture(): 'arm64' | 'x64' {
  // If a specific npm_config_arch is set, we use that one instead of the OS arch (to support cross compilation)
  if (
    process.env.npm_config_arch === 'arm64' ||
    process.env.npm_config_arch === 'x64'
  ) {
    return process.env.npm_config_arch
  }

  if (process.arch === 'arm64') {
    return 'arm64'
  }

  // TODO: Check if it's x64 running on an arm64 Windows with IsWow64Process2
  // More info: https://www.rudyhuyn.com/blog/2017/12/13/how-to-detect-that-your-x86-application-runs-on-windows-on-arm/
  // Right now (March 3, 2021) is not very important because support for x64
  // apps on an arm64 Windows is experimental. See:
  // https://blogs.windows.com/windows-insider/2020/12/10/introducing-x64-emulation-in-preview-for-windows-10-on-arm-pcs-to-the-windows-insider-program/

  return 'x64'
}

export function getUpdatesURL() {
  // update.electronjs.org is Electron's free hosted update feed. It reads the
  // GitHub Releases of a *public* repository and serves a Squirrel-compatible
  // response, which is exactly what Electron's built-in autoUpdater expects
  // (see AppWindow.checkForUpdates).
  //
  // Route shape: /:owner/:repo/:platform-:arch/:currentVersion
  //
  // Caveats worth remembering:
  //  - Releases marked draft or prerelease are skipped by the service, and the
  //    tag must be valid semver ('3.6.4' or 'v3.6.4', NOT 'release-3.6.4').
  //    This is why we have a single release channel.
  //  - Asset filenames must match the service's platform matcher. See the
  //    comments on getOSXZipName / getWindowsStandaloneName.
  const platform = process.platform === 'darwin' ? 'darwin' : 'win32'
  return `https://update.electronjs.org/${getRepositorySlug()}/${platform}-${getDistArchitecture()}/${version}`
}

export function shouldMakeDelta() {
  // Deltas require a sequential release history to diff against, which only
  // the published channel has.
  return getChannel() === 'production'
}

/**
 * Path to the directory containing all icon assets for the current release channel.
 */
export function getIconDirectory() {
  const devOrProd = getChannel() === 'development' ? 'dev' : 'prod'
  return join(projectRoot, 'app', 'static', 'logos', devOrProd)
}

export function getChannelFromReleaseBranch(): string {
  const branchName = process.env.GITHUB_HEAD_REF ?? ''

  // Single channel: a release branch builds the published app, everything else
  // is a development build. See the comment on getChannel.
  return branchName.includes('releases/') ? 'production' : 'development'
}
