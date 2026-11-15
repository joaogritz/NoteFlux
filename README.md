# NoteFlux

Aplicativo desktop que importa arquivos MIDI, reproduz as notas, mostra um piano virtual acompanhando a
música e sincroniza a iluminação RGB de um teclado gamer.

O app segue o arquivo MIDI: não reconhece notas pelo áudio nem escuta o usuário tocar.

> **Estado atual: etapa 1 (base desktop).** A janela abre com o botão "Importar MIDI", que ainda não tem
> implementação. Reprodução, piano virtual e RGB vêm nas próximas etapas (ver [Roadmap](#roadmap)).

## Stack

- [Electron](https://www.electronjs.org/) com [electron-vite](https://electron-vite.org/)
- React + TypeScript na interface
- [@tonejs/midi](https://github.com/Tonejs/Midi) para ler MIDI _(etapa 2)_
- [Tone.js](https://tonejs.github.io/) para reprodução _(etapa 3)_
- Python + [openrgb-python](https://github.com/jath03/openrgb-python) + [OpenRGB](https://openrgb.org/) para
  o RGB _(etapas 5 a 7)_

Detalhes em [docs/architecture.md](docs/architecture.md).

## Preparação

Necessário:

- [Node.js](https://nodejs.org/) LTS (22 ou mais recente), que já inclui o npm
- [Git](https://git-scm.com/)

Confira no terminal:

```bash
node -v
npm -v
git --version
```

Python 3 e OpenRGB só serão necessários a partir da etapa 5. O app deve continuar funcionando sem eles.

## Instalação

```bash
git clone https://github.com/joaogritz/NoteFlux.git
cd NoteFlux
npm install
```

O `npm install` também baixa o binário do Electron.

## Execução

| Comando             | O que faz                                                   |
| ------------------- | ----------------------------------------------------------- |
| `npm run dev`       | Abre o app em modo desenvolvimento, com recarga automática. |
| `npm run build`     | Verifica os tipos e gera o build em `out/`.                 |
| `npm start`         | Abre o app a partir do build (`out/`).                      |
| `npm run build:win` | Gera o instalador para Windows em `dist/`.                  |

No modo desenvolvimento, `F12` abre o DevTools.

## Verificação

Rodar antes de cada commit:

```bash
npm run typecheck   # checagem de tipos (main, preload e interface)
npm run lint        # ESLint
npm run format      # Prettier (corrige a formatação)
```

## Estrutura

```
src/
  main/       processo principal do Electron (janela, arquivos e, depois, o processo Python)
  preload/    ponte segura entre a interface e o processo principal
  renderer/   interface React
resources/    ícone usado pelo app
build/        ícones e configurações do instalador
docs/         arquitetura e, mais adiante, o protocolo Electron–Python
```

## Roadmap

1. **Base Electron + React + TypeScript** ✅
2. Importação e leitura de MIDI
3. Reprodução com play, pause e stop
4. Piano virtual sincronizado
5. Teste isolado do controle RGB em Python, incluindo o testador de LEDs (`keymap.json`)
6. Integração Electron–Python
7. Sincronização MIDI–RGB e calibração de latência

Ao longo das etapas entra a tela de **Configurações**: formato do teclado (60%, 65%, 75%, TKL, 100% ou
personalizado), padrão ABNT2/ANSI, teclas protegidas (que o app nunca acende), destino da iluminação e
ajuste de latência. Detalhes em [docs/architecture.md](docs/architecture.md#configurações).

Fora do MVP: Spotify, PDF, MusicXML, transcrição de áudio, reconhecimento do que o usuário toca, login,
banco de dados, nuvem e integração com vários SDKs de fabricantes.

## Licença

[MIT](LICENSE)
