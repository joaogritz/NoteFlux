import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { Midi } from '@tonejs/midi'
import { parseMidi, type MidiSummary } from './midi/parseMidi'
import { createMidiPlayer, hasPlayableNotes } from './playback/player'
import Piano from './piano/Piano'
import { buildNoteTimeline, EMPTY_TIMELINE, getActiveNotes, sameNotes } from './piano/activeNotes'

const NO_NOTES: ReadonlySet<number> = new Set()

interface LoadedMidi {
  fileName: string
  midi: Midi
  summary: MidiSummary
}

function formatDuration(durationSeconds: number): string {
  const totalSeconds = Math.max(0, Math.round(durationSeconds))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Posição corrente: arredonda para baixo, para não mostrar 0:01 antes de passar 1 segundo. */
function formatPosition(positionSeconds: number): string {
  return formatDuration(Math.floor(Math.max(0, positionSeconds)))
}

function App(): React.JSX.Element {
  const [loadedMidi, setLoadedMidi] = useState<LoadedMidi | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [livePosition, setLivePosition] = useState<number>(0)
  const [liveActiveNotes, setLiveActiveNotes] = useState<ReadonlySet<number>>(NO_NOTES)

  // Leve e sem efeitos colaterais: os recursos do Tone.js só são criados no load().
  const [player] = useState(createMidiPlayer)
  const playbackState = useSyncExternalStore(player.subscribe, player.getState)

  // O player segue o arquivo carregado. Também refaz o agendamento depois do ciclo do StrictMode.
  useEffect(() => {
    if (loadedMidi) {
      player.load(loadedMidi.midi)
    } else {
      player.unload()
    }
  }, [player, loadedMidi])

  useEffect(() => () => player.dispose(), [player])

  const timeline = useMemo(
    () => (loadedMidi ? buildNoteTimeline(loadedMidi.midi) : EMPTY_TIMELINE),
    [loadedMidi]
  )

  // Enquanto toca, a posição e as teclas acesas são lidas do Transport a cada quadro. Não há relógio
  // próprio nem eventos de liga/desliga: o piano é sempre o retrato da posição atual.
  useEffect(() => {
    if (playbackState !== 'playing') return
    let frameId = 0
    // `null` força a primeira atualização do quadro.
    let lastActive: ReadonlySet<number> | null = null
    const update = (): void => {
      const position = player.getPositionSeconds()
      setLivePosition(position)
      const active = getActiveNotes(timeline, position)
      if (lastActive === null || !sameNotes(active, lastActive)) {
        lastActive = active
        setLiveActiveNotes(active)
      }
      frameId = requestAnimationFrame(update)
    }
    frameId = requestAnimationFrame(update)
    return () => {
      cancelAnimationFrame(frameId)
      // Ao pausar ou parar, o próximo play começa com o piano apagado, sem o desenho antigo.
      setLiveActiveNotes(NO_NOTES)
    }
  }, [player, playbackState, timeline])

  const positionSeconds =
    playbackState === 'playing'
      ? livePosition
      : playbackState === 'paused'
        ? player.getPositionSeconds()
        : 0
  // Pausado, parado ou sem arquivo: piano apagado.
  const activeNotes = playbackState === 'playing' ? liveActiveNotes : NO_NOTES
  const durationSeconds = loadedMidi?.summary.durationSeconds ?? 0
  const canPlay = loadedMidi !== null && hasPlayableNotes(loadedMidi.midi)

  const handleImportClick = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const result = await window.noteflux.openMidiFile()

      // Se o usuário cancelar a seleção, nada muda na tela.
      if (result === null) {
        return
      }

      setAudioError(null)

      if (!result.ok) {
        if (result.error === 'too_large') {
          setError('O arquivo passa de 10 MB.')
        } else {
          setError('Não foi possível ler este arquivo MIDI.')
        }
        setLoadedMidi(null)
        return
      }

      try {
        const parsed = parseMidi(result.file.data)
        setLoadedMidi({
          fileName: result.file.fileName,
          midi: parsed.midi,
          summary: parsed.summary
        })
        setError(null)
      } catch {
        setError('Não foi possível ler este arquivo MIDI.')
        setLoadedMidi(null)
      }
    } catch {
      setError('Não foi possível ler este arquivo MIDI.')
      setLoadedMidi(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePlayPauseClick = async (): Promise<void> => {
    if (playbackState === 'playing') {
      player.pause()
      return
    }
    try {
      setAudioError(null)
      await player.play()
    } catch (playError) {
      console.error('Falha ao iniciar o áudio:', playError)
      setAudioError('Não foi possível iniciar o áudio.')
    }
  }

  return (
    <div className="app-shell">
      <main className="app">
        <header className="app-header">
          <h1 className="app-title">NoteFlux</h1>
          <p className="app-subtitle">Piano virtual e iluminação RGB guiados por MIDI</p>
        </header>

        <section className="import-panel">
          <button
            type="button"
            className="primary-button"
            onClick={handleImportClick}
            disabled={isLoading}
          >
            {isLoading ? 'Carregando…' : 'Importar MIDI'}
          </button>

          {error && (
            <p className="notice notice-error" role="status" aria-live="polite">
              {error}
            </p>
          )}

          {!error && !loadedMidi && (
            <p className="notice" role="status" aria-live="polite">
              Nenhum arquivo carregado.
            </p>
          )}

          {loadedMidi && (
            <div className="midi-summary">
              <h2 className="midi-filename">{loadedMidi.fileName}</h2>

              <div className="midi-metrics">
                <div className="metric">
                  <span className="metric-label">Duração</span>
                  <span className="metric-value">
                    {formatDuration(loadedMidi.summary.durationSeconds)}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Trilhas</span>
                  <span className="metric-value">{loadedMidi.summary.trackCount}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Total de notas</span>
                  <span className="metric-value">{loadedMidi.summary.totalNotes}</span>
                </div>
              </div>

              <div className="playback">
                <div className="playback-controls">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handlePlayPauseClick}
                    disabled={isLoading || !canPlay}
                  >
                    {playbackState === 'playing' ? 'Pausar' : 'Tocar'}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={player.stop}
                    disabled={isLoading || playbackState === 'stopped'}
                  >
                    Parar
                  </button>
                  <span className="playback-time" aria-label="Posição e duração">
                    {formatPosition(positionSeconds)} / {formatDuration(durationSeconds)}
                  </span>
                </div>
                <progress
                  className="playback-progress"
                  max={durationSeconds > 0 ? durationSeconds : 1}
                  value={Math.min(positionSeconds, durationSeconds)}
                />
                {audioError && (
                  <p className="notice notice-error" role="status" aria-live="polite">
                    {audioError}
                  </p>
                )}
                {!canPlay && (
                  <p className="notice" role="status">
                    Este arquivo não tem notas para tocar.
                  </p>
                )}
              </div>

              <div className="tracks-section">
                <h3 className="tracks-title">Trilhas</h3>
                <table className="tracks-table">
                  <thead>
                    <tr>
                      <th>Trilha</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadedMidi.summary.tracks.map((track) => (
                      <tr key={track.index}>
                        <td className="track-name">{track.name}</td>
                        <td className="track-notes">
                          {track.noteCount} {track.noteCount === 1 ? 'nota' : 'notas'}
                          {track.isPercussion && ' · percussão, não tocada'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
      <footer className="piano-dock">
        <Piano activeNotes={activeNotes} />
      </footer>
    </div>
  )
}

export default App
