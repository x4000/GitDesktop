import { app, dialog } from 'electron'
import { setCrashMenu } from './menu'
import { formatError } from '../lib/logging/format-error'
import { CrashWindow } from './crash-window'

let hasReportedUncaughtException = false

/** Show the uncaught exception UI. */
export function showUncaughtException(isLaunchError: boolean, error: Error) {
  log.error(formatError(error))

  if (hasReportedUncaughtException) {
    return
  }

  hasReportedUncaughtException = true

  setCrashMenu()

  const window = new CrashWindow(isLaunchError ? 'launch' : 'generic', error)

  window.onDidLoad(() => {
    window.show()
  })

  window.onFailedToLoad(async () => {
    await dialog.showMessageBox({
      type: 'error',
      title: __DARWIN__ ? `Unrecoverable Error` : 'Unrecoverable error',
      // Upstream says the error "has been reported to the team". This fork
      // has no crash reporting, so claiming otherwise would leave users
      // waiting on a fix nobody has been told about.
      message:
        `${__APP_NAME__} has encountered an unrecoverable error and will need to restart.\n\n` +
        `If you encounter this repeatedly, please report it to the ${__APP_NAME__} ` +
        `issue tracker.\n\n${error.stack || error.message}`,
    })

    if (!__DEV__) {
      app.relaunch()
    }
    app.quit()
  })

  window.onClose(() => {
    if (!__DEV__) {
      app.relaunch()
    }
    app.quit()
  })

  window.load()
}
