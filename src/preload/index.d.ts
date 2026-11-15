import type { NoteFluxApi } from './api'

declare global {
  interface Window {
    noteflux: NoteFluxApi
  }
}
