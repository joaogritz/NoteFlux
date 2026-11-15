import { memo } from 'react'
import { PIANO_KEYS, type PianoKey } from './pianoLayout'

interface PianoProps {
  activeNotes: ReadonlySet<number>
}

const WHITE_KEYS = PIANO_KEYS.filter((key) => !key.isBlack)
const BLACK_KEYS = PIANO_KEYS.filter((key) => key.isBlack)

function keyClassName(key: PianoKey, isActive: boolean): string {
  return [
    'piano-key',
    key.isBlack ? 'piano-key-black' : 'piano-key-white',
    isActive ? 'piano-key-active' : ''
  ]
    .filter(Boolean)
    .join(' ')
}

/** Piano de 88 teclas, só para visualização. As teclas em `activeNotes` aparecem acesas. */
function Piano({ activeNotes }: PianoProps): React.JSX.Element {
  return (
    <div className="piano" aria-hidden="true">
      {/* Brancas primeiro e pretas depois, para as pretas ficarem por cima. */}
      {[...WHITE_KEYS, ...BLACK_KEYS].map((key) => (
        <div
          key={key.midi}
          data-note={key.midi}
          className={keyClassName(key, activeNotes.has(key.midi))}
          style={{ left: `${key.leftPercent}%`, width: `${key.widthPercent}%` }}
        >
          {key.label && <span className="piano-key-label">{key.label}</span>}
        </div>
      ))}
    </div>
  )
}

export default memo(Piano)
