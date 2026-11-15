export interface MidiFileData {
  fileName: string
  data: Uint8Array
}

export type OpenMidiResult =
  { ok: true; file: MidiFileData } | { ok: false; error: 'too_large' | 'read_failed' } | null

/**
 * Contrato da API exposta pelo preload em `window.noteflux`.
 */
export interface NoteFluxApi {
  openMidiFile(): Promise<OpenMidiResult>
}
