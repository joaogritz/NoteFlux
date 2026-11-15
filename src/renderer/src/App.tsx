import { useState } from 'react'
import type { Midi } from '@tonejs/midi'
import { parseMidi, type MidiSummary } from './midi/parseMidi'

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

function App(): React.JSX.Element {
  const [loadedMidi, setLoadedMidi] = useState<LoadedMidi | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const handleImportClick = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const result = await window.noteflux.openMidiFile()

      // Se o usuário cancelar a seleção, nada muda na tela.
      if (result === null) {
        return
      }

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

  return (
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
  )
}

export default App
