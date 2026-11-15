# CLAUDE.md — NoteFlux

Contexto e regras para agentes de IA (Claude, Antigravity e outros) que trabalham neste repositório.
Leia este arquivo inteiro antes de alterar o código.

## Objetivo

App desktop que importa MIDI, reproduz as notas, mostra um piano virtual sincronizado e controla os LEDs
de um teclado gamer via OpenRGB. No MVP o app **segue o arquivo MIDI**: não escuta áudio nem o usuário.

## Como trabalhar

- **Implemente apenas a tarefa pedida.** Não antecipe etapas nem adicione recursos fora do escopo.
- Fluxo: tarefa pequena → implementação → verificação → revisão → commit → próxima tarefa.
- Antes de concluir, rode `npm run typecheck` e `npm run lint` e relate o resultado real.
- **Nunca afirme que algo foi testado** (app aberto, som, hardware RGB) se não foi.
- Ao terminar uma entrega, atualize a seção "Estado atual" abaixo.
- Não crie outro repositório nem projetos aninhados. Não sobrescreva arquivos sem ler o conteúdo.
- Idioma: interface, documentação e commits em português. Nomes de código em inglês.

## Stack

Electron + electron-vite · React + TypeScript · @tonejs/midi · Tone.js · Python + openrgb-python · OpenRGB.

## Responsabilidades

| Camada                       | Faz                                                                                         | Não faz                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Renderer (`src/renderer`)    | Lê o MIDI, controla a linha do tempo, toca as notas, desenha o piano e gera comandos de luz | Acessar Node.js, arquivos ou Python direto |
| Preload (`src/preload`)      | Expõe `window.noteflux` com funções específicas e tipadas                                   | Expor o `ipcRenderer` inteiro              |
| Main (`src/main`)            | Janela, diálogo/leitura de arquivos, ciclo de vida do processo Python, ponte de mensagens   | Lógica musical                             |
| Python (`python/`, etapa 5+) | Recebe comandos de luz, mapeia teclas para LEDs, fala com o OpenRGB                         | Ler MIDI ou ter um relógio/motor próprio   |

## Regras de arquitetura

- `contextIsolation: true`, `nodeIntegration: false` e `sandbox: true` no `BrowserWindow`. Não alterar.
- Toda função nova da API do preload é tipada em `src/preload/api.ts`.
- **Uma única referência de tempo musical** (o Transport do Tone.js, a partir da etapa 3). Piano e RGB
  derivam desse relógio.
- Electron ↔ Python por **JSON Lines via stdin/stdout**. Sem FastAPI, Flask, webhook ou servidor HTTP.
  O protocolo é documentado em `docs/protocol.md` **antes** da integração (etapa 6).
- Prever **ajuste de latência do RGB**: um LED acionado no callback de agendamento não coincide
  automaticamente com o som.
- O app deve funcionar **sem Python e sem hardware RGB**, com um **modo simulado** de iluminação.
- Parar a reprodução apaga as notas e libera os LEDs acionados pelo app (restaura a iluminação anterior
  quando o dispositivo permitir).
- Encerrar o processo Python corretamente ao fechar o app ou quando ele falhar.

## Teclado e configurações (decisões de 14/11/2026)

Detalhes em `docs/architecture.md`, seções "Teclado de iluminação" e "Configurações".

- O teclado iluminado é o **teclado do computador** (gamer RGB), não um teclado musical.
- Cadeia: nota MIDI → código de tecla (renderer) → índice de LED (Python, via `keymap.json`). O
  vocabulário comum são os códigos do `KeyboardEvent.code` (`KeyA`, `Escape`, `IntlRo`…).
- **Teclas protegidas** (padrão: Esc, Enter, Backspace, Tab, Shift, Ctrl, Alt, Win, Espaço, setas) nunca
  são acesas. A regra é aplicada no renderer e repetida no Python como trava.
- **Configurações:** formato (60%, 65%, 75%, TKL, 100%, Personalizado), padrão físico (ABNT2, ANSI),
  teclas protegidas, keymap, destino da iluminação, dispositivo e latência. Ficam salvas em
  `settings.json` pelo main e são acessadas só pelo preload.
- **Testador de LEDs** `python/tools/keymap_probe.py` na etapa 5: usa os nomes dos LEDs do OpenRGB ou
  acende um LED por vez para a pessoa indicar a tecla.

## Fora do MVP — não adicionar

Spotify · PDF · MusicXML · transcrição de MP3/WAV · reconhecimento do usuário tocando · login · banco de
dados · nuvem · vários SDKs de fabricantes · integração obrigatória com bibliotecas externas de músicas.

## Não versionar

`node_modules/`, `out/`, `dist/`, ambientes virtuais Python, `.env` e credenciais (ver `.gitignore`).

## Comandos verificados

| Comando               | Verificado                                              |
| --------------------- | ------------------------------------------------------- |
| `npm install`         | Sim (Linux, Node 22)                                    |
| `npm run typecheck`   | Sim, sem erros                                          |
| `npm run lint`        | Sim, sem erros                                          |
| `npm run build`       | Sim                                                     |
| App a partir do build | Sim, janela renderizada em display virtual (Linux)      |
| `npm run dev`         | Sim no Linux (display virtual); **pendente no Windows** |

## Estado atual

- **Etapa 1 — Base desktop: concluída.** Janela "NoteFlux" com o botão "Importar MIDI", que só mostra
  um aviso. A API do preload (`window.noteflux`) ainda está vazia.
- **Próxima: etapa 2 — Importar e ler MIDI.** Diálogo de arquivo no main (filtro `.mid/.midi`), função
  tipada no preload, leitura com `@tonejs/midi` no renderer e exibição de duração, trilhas e quantidade
  de notas. Sem reprodução nessa etapa.

## Em aberto

Modelo e compatibilidade do teclado RGB · sistema operacional de cada colaborador · regra de mapeamento
entre notas e teclas · restauração da iluminação anterior · samples de piano e licenças · empacotamento do
auxiliar Python.
