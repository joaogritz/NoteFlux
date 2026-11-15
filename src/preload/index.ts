import { contextBridge, ipcRenderer } from 'electron'
import type { NoteFluxApi } from './api'

/**
 * Única ponte entre a interface (renderer) e o processo principal.
 *
 * Regras:
 * - Expor apenas funções específicas, nunca o ipcRenderer inteiro.
 * - Cada função nova deve ser tipada em ./api.ts e documentada em docs/architecture.md.
 */
const api: NoteFluxApi = {
  openMidiFile: () => ipcRenderer.invoke('midi:open')
}

contextBridge.exposeInMainWorld('noteflux', api)
