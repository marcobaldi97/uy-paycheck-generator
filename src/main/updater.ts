// Updates from the GitHub Releases that CI publishes (electron-builder.yml `publish`).
// The installer build downloads the update in the background and only installs it from the
// dialog, after a mandatory database backup. The portable build can't update itself, so it
// only offers to open the release page.

import { app, dialog, shell, type BrowserWindow } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import {
  carpetaRespaldoActualizacion,
  respaldarAntesDeActualizar,
  respaldarEInstalar,
} from './services/actualizaciones'

const PAGINA_RELEASES = 'https://github.com/marcobaldi97/uy-paycheck-generator/releases/latest'

/** Checks once for a newer release. Does nothing in development. Errors are only logged. */
export function buscarActualizaciones(win: BrowserWindow): void {
  if (!app.isPackaged) return

  const portable = Boolean(process.env['PORTABLE_EXECUTABLE_DIR'])
  autoUpdater.logger = console
  autoUpdater.autoDownload = !portable
  // Installing only from the dialog guarantees the backup runs first. A postponed update is
  // already downloaded, so the dialog shows up again on the next launch.
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('error', (error) => console.error('[actualizaciones]', error))
  if (portable) {
    autoUpdater.on('update-available', (info) => void ofrecerDescarga(win, info))
  } else {
    autoUpdater.on('update-downloaded', (info) => void ofrecerInstalacion(win, info))
  }

  autoUpdater.checkForUpdates().catch((error: unknown) => {
    console.error('[actualizaciones] check failed', error)
  })
}

async function ofrecerInstalacion(win: BrowserWindow, info: UpdateInfo): Promise<void> {
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    title: 'Actualización disponible',
    message: `La versión ${info.version} está lista para instalarse.`,
    detail: 'Antes de instalar se hará un respaldo de la base de datos.',
    buttons: ['Respaldar e instalar', 'Más tarde'],
    defaultId: 0,
    cancelId: 1,
  })
  if (response !== 0) return

  const carpeta = carpetaRespaldoActualizacion(app.getPath('userData'), app.getVersion())
  try {
    await respaldarEInstalar(
      () => respaldarAntesDeActualizar(carpeta),
      () => autoUpdater.quitAndInstall(),
    )
  } catch (error) {
    console.error('[actualizaciones] backup failed', error)
    dialog.showErrorBox(
      'No se pudo actualizar',
      'No se pudo respaldar la base de datos; la actualización no se instaló.',
    )
  }
}

async function ofrecerDescarga(win: BrowserWindow, info: UpdateInfo): Promise<void> {
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    title: 'Actualización disponible',
    message: `Hay una nueva versión: ${info.version}.`,
    detail: 'Descargala desde la página de versiones y reemplazá este archivo.',
    buttons: ['Descargar', 'Más tarde'],
    defaultId: 0,
    cancelId: 1,
  })
  if (response === 0) void shell.openExternal(PAGINA_RELEASES)
}
