import { Midi } from '@tonejs/midi'

export interface TrackSummary {
  index: number
  name: string
  noteCount: number
  /** Trilha de percussão (canal 10 do General MIDI). Não é tocada. */
  isPercussion: boolean
}

export interface MidiSummary {
  durationSeconds: number
  trackCount: number
  totalNotes: number
  tracks: TrackSummary[]
}

export interface ParsedMidi {
  midi: Midi
  summary: MidiSummary
}

export class MidiParseError extends Error {
  constructor(message = 'Não foi possível ler este arquivo MIDI.', options?: ErrorOptions) {
    super(message, options)
    this.name = 'MidiParseError'
  }
}

/**
 * Função pura que recebe os bytes de um arquivo MIDI, analisa com @tonejs/midi
 * e devolve o objeto Midi e um resumo estruturado.
 */
export function parseMidi(data: Uint8Array): ParsedMidi {
  let midi: Midi
  try {
    midi = new Midi(data)
  } catch (error) {
    throw new MidiParseError('Não foi possível ler este arquivo MIDI.', { cause: error })
  }

  const tracks: TrackSummary[] = midi.tracks.map((track, i) => ({
    index: i,
    name: track.name && track.name.trim() !== '' ? track.name.trim() : `Trilha ${i + 1}`,
    noteCount: track.notes.length,
    isPercussion: track.instrument.percussion
  }))

  const totalNotes = tracks.reduce((total, track) => total + track.noteCount, 0)

  const summary: MidiSummary = {
    durationSeconds: midi.duration,
    trackCount: tracks.length,
    totalNotes,
    tracks
  }

  return { midi, summary }
}
