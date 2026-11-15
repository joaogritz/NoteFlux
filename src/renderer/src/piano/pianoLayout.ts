/** Faixa de um piano acústico de 88 teclas: Lá0 (21) a Dó8 (108). */
export const PIANO_FIRST_NOTE = 21
export const PIANO_LAST_NOTE = 108

/** Largura da tecla preta em relação à branca. */
const BLACK_KEY_WIDTH_RATIO = 0.6

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10])

export interface PianoKey {
  midi: number
  isBlack: boolean
  /** Posição e largura em porcentagem da largura total do piano. */
  leftPercent: number
  widthPercent: number
  /** Rótulo para os Dós (`C1`…`C8`, com `C4` = Dó central); vazio nas outras teclas. */
  label: string
}

export function isBlackKey(midi: number): boolean {
  return BLACK_PITCH_CLASSES.has(midi % 12)
}

function buildPianoLayout(): PianoKey[] {
  let whiteCount = 0
  for (let midi = PIANO_FIRST_NOTE; midi <= PIANO_LAST_NOTE; midi++) {
    if (!isBlackKey(midi)) whiteCount++
  }

  const whiteWidth = 100 / whiteCount
  const blackWidth = whiteWidth * BLACK_KEY_WIDTH_RATIO
  const keys: PianoKey[] = []
  let whiteIndex = 0

  for (let midi = PIANO_FIRST_NOTE; midi <= PIANO_LAST_NOTE; midi++) {
    if (isBlackKey(midi)) {
      // Centralizada na divisa entre a tecla branca anterior e a próxima.
      keys.push({
        midi,
        isBlack: true,
        leftPercent: whiteIndex * whiteWidth - blackWidth / 2,
        widthPercent: blackWidth,
        label: ''
      })
    } else {
      keys.push({
        midi,
        isBlack: false,
        leftPercent: whiteIndex * whiteWidth,
        widthPercent: whiteWidth,
        label: midi % 12 === 0 ? `C${Math.floor(midi / 12) - 1}` : ''
      })
      whiteIndex++
    }
  }
  return keys
}

/** As 88 teclas: 52 brancas e 36 pretas. */
export const PIANO_KEYS: readonly PianoKey[] = buildPianoLayout()
