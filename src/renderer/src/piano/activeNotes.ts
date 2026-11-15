import type { Midi } from '@tonejs/midi'

export interface TimelineNote {
  midi: number
  start: number
  end: number
}

export interface NoteTimeline {
  /** Notas tocáveis (sem percussão), ordenadas por início. */
  notes: TimelineNote[]
  /** Maior duração de nota, para limitar a busca. */
  maxDuration: number
}

export const EMPTY_TIMELINE: NoteTimeline = { notes: [], maxDuration: 0 }

/** Monta a linha do tempo das notas tocáveis. Trilhas de percussão ficam de fora, como no player. */
export function buildNoteTimeline(midi: Midi): NoteTimeline {
  const notes = midi.tracks
    .filter((track) => !track.instrument.percussion)
    .flatMap((track) =>
      track.notes.map((note) => ({
        midi: note.midi,
        start: note.time,
        end: note.time + note.duration
      }))
    )
    .sort((a, b) => a.start - b.start)

  const maxDuration = notes.reduce((max, note) => Math.max(max, note.end - note.start), 0)
  return { notes, maxDuration }
}

/** Índice da primeira nota com início maior que `position` (busca binária). */
function firstStartAfter(notes: TimelineNote[], position: number): number {
  let low = 0
  let high = notes.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (notes[middle].start <= position) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

/**
 * Notas soando em `positionSeconds`: `start <= posição < end`.
 *
 * Só olha as notas que começaram até `maxDuration` segundos antes da posição, então o custo não cresce com
 * o tamanho do arquivo. Uma nota que começa exatamente no fim de outra da mesma tecla mantém a tecla acesa.
 */
export function getActiveNotes(timeline: NoteTimeline, positionSeconds: number): Set<number> {
  const active = new Set<number>()
  const { notes, maxDuration } = timeline
  const earliestStart = positionSeconds - maxDuration

  for (let i = firstStartAfter(notes, positionSeconds) - 1; i >= 0; i--) {
    const note = notes[i]
    if (note.start < earliestStart) break
    if (positionSeconds < note.end) active.add(note.midi)
  }
  return active
}

/** Compara dois conjuntos de notas, para só atualizar a tela quando algo mudar. */
export function sameNotes(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false
  for (const note of a) {
    if (!b.has(note)) return false
  }
  return true
}
