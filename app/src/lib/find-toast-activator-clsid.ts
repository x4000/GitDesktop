import * as path from 'path'
import * as os from 'os'
import { shell } from 'electron'

/**
 * Checks all Windows shortcuts created by Squirrel looking for the toast
 * activator CLSID needed to handle Windows notifications from the Action Center.
 */
export function findToastActivatorClsid() {
  // These must name OUR shortcuts. Left as upstream's, the lookup would find
  // an installed GitHub Desktop's shortcut on the same machine and hand back
  // its toast activator, so our notifications would be attributed to -- and
  // routed through -- a different application entirely.
  const shortcutPaths = [
    path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Microsoft',
      'Windows',
      'Start Menu',
      'Programs',
      __COMPANY_NAME__,
      `${__APP_NAME__}.lnk`
    ),
    path.join(os.homedir(), 'Desktop', `${__APP_NAME__}.lnk`),
  ]

  for (const shortcutPath of shortcutPaths) {
    const toastActivatorClsid = findToastActivatorClsidInShorcut(shortcutPath)

    if (toastActivatorClsid !== undefined) {
      return toastActivatorClsid
    }
  }

  return undefined
}

function findToastActivatorClsidInShorcut(shortcutPath: string) {
  try {
    const shortcutDetails = shell.readShortcutLink(shortcutPath)

    if (
      shortcutDetails.toastActivatorClsid === undefined ||
      shortcutDetails.toastActivatorClsid === ''
    ) {
      return undefined
    }

    return shortcutDetails.toastActivatorClsid
  } catch (error) {
    log.error(
      `Error looking for toast activator CLSID in shortcut ${shortcutPath}`,
      error
    )
    return undefined
  }
}
