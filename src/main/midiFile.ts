import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { readFile, stat } from 'fs/promises'
import { basename } from 'path'
import type { OpenMidiResult } from '../preload/api'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

export function registerMidiHandlers(): void {
  ipcMain.handle('midi:open', async (event): Promise<OpenMidiResult> => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
      const dialogOptions: OpenDialogOptions = {
        properties: ['openFile'],
        filters: [{ name: 'Arquivos MIDI', extensions: ['mid', 'midi'] }]
      }

      const dialogResult = window
        ? await dialog.showOpenDialog(window, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)

      if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
        return null
      }

      const filePath = dialogResult.filePaths[0]
      const fileStats = await stat(filePath)

      if (fileStats.size > MAX_FILE_SIZE_BYTES) {
        return { ok: false, error: 'too_large' }
      }

      const fileBuffer = await readFile(filePath)
      return {
        ok: true,
        file: {
          fileName: basename(filePath),
          data: new Uint8Array(fileBuffer)
        }
      }
    } catch (error) {
      console.error('Falha ao abrir ou ler o arquivo MIDI:', error)
      return { ok: false, error: 'read_failed' }
    }
  })
}
