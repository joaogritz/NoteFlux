import { contextBridge } from 'electron'
import type { NoteFluxApi } from './api'

/**
 * Única ponte entre a interface (renderer) e o processo principal.
 *
 * Regras:
 * - Expor apenas funções específicas, nunca o ipcRenderer inteiro.
 * - Cada função nova deve ser tipada em ./api.ts e documentada em docs/architecture.md.
 *
 * Na etapa 1 a API ainda está vazia: o botão "Importar MIDI" não tem implementação.
 */
const api: NoteFluxApi = {}

contextBridge.exposeInMainWorld('noteflux', api)
