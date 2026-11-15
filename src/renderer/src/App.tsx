import { useState } from 'react'

function App(): React.JSX.Element {
  const [notice, setNotice] = useState<string | null>(null)

  // Etapa 1: o botão existe, mas a importação ainda não foi implementada.
  // A etapa 2 vai abrir o seletor de arquivos via window.noteflux e ler o MIDI com @tonejs/midi.
  const handleImportClick = (): void => {
    setNotice('A importação de MIDI ainda não foi implementada.')
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1 className="app-title">NoteFlux</h1>
        <p className="app-subtitle">Piano virtual e iluminação RGB guiados por MIDI</p>
      </header>

      <section className="import-panel">
        <button type="button" className="primary-button" onClick={handleImportClick}>
          Importar MIDI
        </button>
        <p className="notice" role="status" aria-live="polite">
          {notice ?? 'Nenhum arquivo carregado.'}
        </p>
      </section>
    </main>
  )
}

export default App
