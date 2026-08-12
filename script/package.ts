/* eslint-disable no-sync */

import * as cp from 'child_process'
import * as path from 'path'
import * as electronInstaller from 'electron-winstaller'
import {
  getProductName,
  getCompanyName,
  getRepositorySlug,
} from '../app/package-info'
import {
  getDistPath,
  getOSXZipPath,
  getWindowsIdentifierName,
  getWindowsStandaloneName,
  getWindowsInstallerName,
  shouldMakeDelta,
  getBundleSizes,
  getDistRoot,
  getDistArchitecture,
  getIconDirectory,
} from './dist-info'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { getVersion } from '../app/package-info'
import { computeBundleHashSync } from '../app/src/lib/compute-bundle-hash'
import { rename } from 'fs/promises'
import { join } from 'path'

const distPath = getDistPath()
const productName = getProductName()
const outputDir = getDistRoot()

if (process.platform === 'darwin') {
  packageOSX()
} else if (process.platform === 'win32') {
  packageWindows()
} else {
  console.error(`I don't know how to package for ${process.platform} :(`)
  process.exit(1)
}

console.log('Writing bundle size info…')
writeFileSync(
  path.join(getDistRoot(), 'bundle-size.json'),
  JSON.stringify(getBundleSizes())
)

console.log('Writing bundle hash…')
writeFileSync(
  path.join(getDistRoot(), 'bundle-hash.json'),
  JSON.stringify({
    bundleHash: computeBundleHashSync(path.join(__dirname, '..', 'out')),
  })
)

function packageOSX() {
  const dest = getOSXZipPath()
  rmSync(dest, { recursive: true, force: true })

  console.log('Packaging for macOS…')
  cp.execSync(
    `ditto -ck --keepParent "${distPath}/${productName}.app" "${dest}"`
  )
}

async function packageWindows() {
  const iconSource = join(getIconDirectory(), 'icon-logo.ico')

  if (!existsSync(iconSource)) {
    console.error(`expected setup icon not found at location: ${iconSource}`)
    process.exit(1)
  }

  const splashScreenPath = path.resolve(
    __dirname,
    '../app/static/logos/win32-installer-splash.gif'
  )

  if (!existsSync(splashScreenPath)) {
    console.error(
      `expected setup splash screen gif not found at location: ${splashScreenPath}`
    )
    process.exit(1)
  }

  // Shown by Windows in Add/Remove Programs. Squirrel requires a remote URL,
  // not a local file, so this points at the master artwork in our own repo.
  // (Upstream used https://desktop.githubusercontent.com/app-icon.ico.)
  const iconUrl =
    'https://raw.githubusercontent.com/x4000/GitDesktop/main/app/static/logos/app-icon.png'

  const nugetPkgName = getWindowsIdentifierName()
  const options: electronInstaller.Options = {
    name: nugetPkgName,
    appDirectory: distPath,
    outputDirectory: outputDir,
    authors: getCompanyName(),
    iconUrl: iconUrl,
    setupIcon: iconSource,
    loadingGif: splashScreenPath,
    exe: `${nugetPkgName}.exe`,
    title: productName,
    setupExe: getWindowsStandaloneName(),
    setupMsi: getWindowsInstallerName(),
  }

  // Whether deltas are actually being produced, as opposed to merely wanted.
  // The rename step below depends on this too: it looked for a delta package
  // unconditionally and died with ENOENT when one was not built.
  let makingDeltas = false

  if (shouldMakeDelta()) {
    // Squirrel needs a *previous* release to diff a delta package against.
    //
    // Upstream pointed this at their update endpoint, which always has one.
    // Ours did not on the first release, and Squirrel does not treat that as
    // "no deltas then" -- it fails the whole packaging step with a 404 buried
    // in a .NET stack trace.
    //
    // So: ask GitHub whether a release exists, and only enable deltas if one
    // does. This is self-healing -- deltas switch on by themselves from the
    // second release onwards, with no flag to remember to flip.
    //
    // The value is the repository root URL rather than the update feed.
    // Squirrel understands GitHub repositories natively (its error message
    // asks for exactly this shape), and going straight to the source avoids
    // depending on how the update service answers a RELEASES request for a
    // version that is not yet published.
    const repositoryURL = `https://github.com/${getRepositorySlug()}`

    if (await hasPublishedRelease()) {
      options.remoteReleases = repositoryURL
      makingDeltas = true
    } else {
      console.log(
        'No published release found; building a full package with no deltas.'
      )
    }
  }

  // Upstream signs Windows builds with GitHub's own Azure Code Signing
  // certificate profile ('GitHubInc'), which we obviously cannot use. Windows
  // builds from this fork are unsigned.
  //
  // Note that update.electronjs.org does NOT require signed Windows builds --
  // it only mandates code signing for macOS and MSIX. Unsigned installers do
  // trigger a SmartScreen warning on first run for users, which is the cost of
  // not buying a certificate. If a certificate is acquired later, set
  // options.signWithParams here.

  console.log('Packaging for Windows…')
  electronInstaller
    .createWindowsInstaller(options)
    .then(() => console.log(`Installers created in ${outputDir}`))
    .then(async () => {
      // electron-winstaller (more specifically Squirrel.Windows) doesn't let
      // us control the name of the nuget packages but we want them to include
      // the architecture similar to how the setup exe does so we'll just have
      // to rename them here after the fact.
      //
      // The '-win32-<arch>-' infix (rather than upstream's '-<arch>-') is
      // required by update.electronjs.org's asset matcher. Because a single
      // GitHub Release serves every architecture, and the service always
      // fetches an asset literally named 'RELEASES', both architectures'
      // entries end up in one RELEASES file -- the service then picks the
      // right .nupkg out of it per architecture. That only works if the
      // filenames in RELEASES are arch-qualified, so we rewrite the file to
      // match the names we just renamed to.
      const arch = getDistArchitecture()
      const prefix = `${getWindowsIdentifierName()}-${getVersion()}`
      const releasesPath = join(outputDir, 'RELEASES')

      let releases = existsSync(releasesPath)
        ? readFileSync(releasesPath, 'utf8')
        : undefined

      for (const kind of makingDeltas ? ['full', 'delta'] : ['full']) {
        const fromName = `${prefix}-${kind}.nupkg`
        const toName = `${prefix}-win32-${arch}-${kind}.nupkg`

        console.log(`Renaming ${fromName} to ${toName}`)
        await rename(join(outputDir, fromName), join(outputDir, toName))

        // Squirrel generated RELEASES before we renamed anything, so its
        // entries still reference the original filenames.
        releases = releases?.split(fromName).join(toName)
      }

      if (releases !== undefined) {
        releases = absolutizeReleaseUrls(releases)
        console.log(`Rewriting ${releasesPath} to match renamed packages`)
        writeFileSync(releasesPath, releases, 'utf8')
      }
    })
    .catch(e => {
      console.error(`Error packaging: ${e}`)
      process.exit(1)
    })
}

/**
 * Whether the repository has at least one published release for Squirrel to
 * build delta packages against.
 *
 * Unauthenticated: this only needs the public releases list, and requiring a
 * token would make local packaging depend on credentials it otherwise does
 * not need. A network failure is treated as "no release" -- packaging without
 * deltas succeeds, whereas guessing wrong the other way fails the build.
 */
async function hasPublishedRelease(): Promise<boolean> {
  const url = `https://api.github.com/repos/${getRepositorySlug()}/releases/latest`

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': getWindowsIdentifierName(),
      },
    })

    if (response.status === 404) {
      return false
    }

    if (!response.ok) {
      console.warn(
        `Could not determine whether a release exists (HTTP ${response.status}); skipping deltas.`
      )
      return false
    }

    return true
  } catch (e) {
    console.warn(`Could not reach ${url}; skipping deltas.`, e)
    return false
  }
}

/**
 * Rewrite every package reference in a RELEASES file to an absolute URL.
 *
 * Squirrel writes bare filenames, which it resolves against the feed URL when
 * downloading. That works against a plain file server; update.electronjs.org
 * is not one. It rewrites a package name to an absolute GitHub URL itself --
 * but only *one* per response. A RELEASES file with deltas has three entries
 * (previous full, new delta, new full), so the two the client actually needs
 * stay relative, and requesting them from the service returns its JSON update
 * object rather than a package. Squirrel then downloads a couple of hundred
 * bytes of JSON and the update fails.
 *
 * Doing the rewrite ourselves makes every entry absolute, so nothing depends
 * on the service's substitution. Its own rewrite then finds nothing to replace
 * and passes the body through untouched.
 *
 * Every package named here is present in `dist` at upload time -- Squirrel
 * copies the previous release's package in when building a delta -- so all of
 * them are assets of *this* release, and one tag resolves them all.
 */
function absolutizeReleaseUrls(releases: string): string {
  const base = `https://github.com/${getRepositorySlug()}/releases/download/${getVersion()}`

  return releases
    .split('\n')
    .map(line => {
      // "<SHA1> <package> <size>", where <package> may already be a URL.
      const parts = line.trim().split(/\s+/)

      if (parts.length < 3 || parts[1].includes('://')) {
        return line
      }

      parts[1] = `${base}/${parts[1]}`
      return parts.join(' ')
    })
    .join('\n')
}
