import * as Tone from 'tone'
import type { Midi } from '@tonejs/midi'

export type PlaybackState = 'stopped' | 'playing' | 'paused'

/**
 * Motor de reprodução do NoteFlux. Concentra todo o uso do Tone.js.
 *
 * O relógio é o Transport do Tone.js: a posição exposta vem de `Transport.seconds`, nunca de um
 * contador próprio. Piano (etapa 4) e luz (etapa 7) devem derivar do mesmo Transport.
 *
 * Os recursos de áudio (sintetizador, Part) são criados sob demanda em `load()` e liberados em
 * `dispose()`. Um `load()` depois de `dispose()` os recria, o que mantém o player válido no ciclo
 * montar → desmontar → montar do StrictMode.
 */
export interface MidiPlayer {
  /** Substitui o que estiver carregado e volta para 'stopped'. */
  load(midi: Midi): void
  unload(): void
  /** Chama Tone.start() e toca; continua de onde pausou. */
  play(): Promise<void>
  pause(): void
  /** Para e volta para 0:00. */
  stop(): void
  getState(): PlaybackState
  /** Posição que está soando agora (sem o lookahead do Tone.js). 0 quando parado. */
  getPositionSeconds(): number
  getDurationSeconds(): number
  /** Assina mudanças de estado. Devolve a função para cancelar a assinatura. */
  subscribe(listener: () => void): () => void
  /** Para a reprodução e libera os recursos do Tone.js. */
  dispose(): void
}

interface ScheduledNote {
  time: number
  name: string
  duration: number
  velocity: number
}

const SYNTH_OPTIONS = {
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.4 }
} as const
const SYNTH_MAX_POLYPHONY = 64
const SYNTH_VOLUME_DB = -8

/** Notas tocáveis em ordem de tempo. Trilhas de percussão (canal 10 do GM) ficam de fora. */
function collectPlayableNotes(midi: Midi): ScheduledNote[] {
  return midi.tracks
    .filter((track) => !track.instrument.percussion)
    .flatMap((track) =>
      track.notes.map((note) => ({
        // Em segundos, com as mudanças de andamento já aplicadas pelo @tonejs/midi.
        time: note.time,
        name: note.name,
        duration: note.duration,
        velocity: note.velocity
      }))
    )
    .sort((a, b) => a.time - b.time)
}

/** Função pura: o arquivo tem alguma nota que o player vai tocar? */
export function hasPlayableNotes(midi: Midi): boolean {
  return (
    midi.duration > 0 &&
    midi.tracks.some((track) => !track.instrument.percussion && track.notes.length > 0)
  )
}

export function createMidiPlayer(): MidiPlayer {
  let state: PlaybackState = 'stopped'
  let synth: Tone.PolySynth | null = null
  let part: Tone.Part<ScheduledNote> | null = null
  let durationSeconds = 0
  let hasNotes = false
  // Incrementado a cada load/unload/dispose para descartar um play() que ainda aguardava Tone.start().
  let generation = 0
  let endTimer: number | null = null
  const listeners = new Set<() => void>()

  const clearEndTimer = (): void => {
    if (endTimer !== null) {
      window.clearTimeout(endTimer)
      endTimer = null
    }
  }

  const setState = (next: PlaybackState): void => {
    if (state === next) return
    state = next
    listeners.forEach((listener) => listener())
  }

  const getSynth = (): Tone.PolySynth => {
    if (!synth) {
      synth = new Tone.PolySynth(Tone.Synth, SYNTH_OPTIONS).toDestination()
      synth.maxPolyphony = SYNTH_MAX_POLYPHONY
      synth.volume.value = SYNTH_VOLUME_DB
    }
    return synth
  }

  const silence = (): void => {
    synth?.releaseAll()
  }

  const stop = (): void => {
    const transport = Tone.getTransport()
    // transport.stop() já volta a posição para 0. Só chamar quando necessário: cada chamada
    // acrescenta um evento à linha do tempo interna do Tone.js.
    if (transport.state !== 'stopped') transport.stop()
    clearEndTimer()
    silence()
    setState('stopped')
  }

  const clearSchedule = (): void => {
    part?.dispose()
    part = null
    Tone.getTransport().cancel(0)
    durationSeconds = 0
    hasNotes = false
  }

  const unload = (): void => {
    generation++
    // Nada carregado: não toca no Tone.js (evita criar o AudioContext sem necessidade).
    if (!part && !hasNotes && state === 'stopped') return
    stop()
    clearSchedule()
  }

  const load = (midi: Midi): void => {
    unload()

    const notes = collectPlayableNotes(midi)
    durationSeconds = midi.duration
    hasNotes = hasPlayableNotes(midi)
    if (!hasNotes) return

    const instrument = getSynth()
    part = new Tone.Part<ScheduledNote>((time, note) => {
      // Sempre o `time` recebido do Transport, nunca Tone.now().
      instrument.triggerAttackRelease(note.name, note.duration, time, note.velocity)
    }, notes)
    part.start(0)

    const loadedAt = generation
    Tone.getTransport().scheduleOnce((time) => {
      // Fim da música. O callback roda um pouco antes do áudio (lookahead), então o estado só muda
      // quando o som chega ao fim. Não usar Tone.getDraw() aqui: ele depende de requestAnimationFrame,
      // que não roda com a janela minimizada, e descarta eventos atrasados. O player ficaria preso
      // em 'playing' depois de a janela voltar.
      const delayMs = Math.max(0, (time - Tone.getContext().currentTime) * 1000)
      clearEndTimer()
      endTimer = window.setTimeout(() => {
        endTimer = null
        if (loadedAt === generation && state === 'playing') stop()
      }, delayMs)
    }, durationSeconds)
  }

  // Lido por função para o TypeScript não fixar o estado de antes do `await`.
  const getState = (): PlaybackState => state

  const play = async (): Promise<void> => {
    if (getState() === 'playing' || !hasNotes) return
    const requestedAt = generation
    await Tone.start()
    // Outro arquivo foi carregado (ou o player foi liberado) enquanto o áudio iniciava,
    // ou um segundo clique já iniciou a reprodução.
    if (requestedAt !== generation || getState() === 'playing' || !hasNotes) return
    Tone.getTransport().start()
    setState('playing')
  }

  const pause = (): void => {
    if (state !== 'playing') return
    Tone.getTransport().pause()
    silence()
    setState('paused')
  }

  const getPositionSeconds = (): number => {
    if (state === 'stopped') return 0
    // Posição audível: `Transport.seconds` é a posição em Tone.now(), ~0,1 s à frente do som (lookahead).
    // Para a tela (tempo e piano), o que importa é o que está soando agora.
    // Pausado, a posição é a do ponto de pausa (que fica no fim do lookahead).
    const transport = Tone.getTransport()
    const position =
      state === 'paused' ? transport.seconds : transport.getSecondsAtTime(Tone.immediate())
    return Math.min(Math.max(0, position), durationSeconds)
  }

  const dispose = (): void => {
    unload()
    synth?.dispose()
    synth = null
  }

  return {
    load,
    unload,
    play,
    pause,
    stop,
    getState,
    getPositionSeconds,
    getDurationSeconds: () => durationSeconds,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose
  }
}
