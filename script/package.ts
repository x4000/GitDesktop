/* eslint-disable no-sync */

import * as cp from 'child_process'
import * as path from 'path'
import * as electronInstaller from 'electron-winstaller'
import { getProductName, getCompanyName } from '../app/package-info'
import {
  getDistPath,
  getOSXZipPath,
  getWindowsIdentifierName,
  getWindowsStandaloneName,
  getWindowsInstallerName,
  shouldMakeDelta,
  getUpdatesURL,
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

function packageWindows() {
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

  if (shouldMakeDelta()) {
    // Squirrel.Windows fetches the previous RELEASES from here to build the
    // delta package against. Upstream appended a 'bypassStaggeredRelease'
    // query parameter, which is a central.github.com feature and meaningless
    // to update.electronjs.org, so it is dropped.
    options.remoteReleases = getUpdatesURL()
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

      for (const kind of shouldMakeDelta() ? ['full', 'delta'] : ['full']) {
        const fromName = `${prefix}-${kind}.nupkg`
        const toName = `${prefix}-win32-${arch}-${kind}.nupkg`

        console.log(`Renaming ${fromName} to ${toName}`)
        await rename(join(outputDir, fromName), join(outputDir, toName))

        // Squirrel generated RELEASES before we renamed anything, so its
        // entries still reference the original filenames.
        releases = releases?.split(fromName).join(toName)
      }

      if (releases !== undefined) {
        console.log(`Rewriting ${releasesPath} to match renamed packages`)
        writeFileSync(releasesPath, releases, 'utf8')
      }
    })
    .catch(e => {
      console.error(`Error packaging: ${e}`)
      process.exit(1)
    })
}
