# Arquitetura do NoteFlux

## Visão geral

```
Arquivo .mid
  → @tonejs/midi                  (renderer)  notas, trilhas e linha do tempo
  → reprodutor com Tone.js        (renderer)  relógio musical único
      ├→ som
      ├→ piano virtual em React   (renderer)
      └→ comandos de iluminação   (renderer)
           ├→ modo simulado na tela
           └→ ponte Electron      (preload → main)
                → processo Python (JSON Lines via stdin/stdout)
                  → openrgb-python
                  → OpenRGB SDK Server
                  → teclado compatível
```

Só existe **uma leitura do MIDI** e **um motor de reprodução**, ambos no renderer. O Python apenas executa
comandos de iluminação.

## Processos

### Main — `src/main/`

- Cria e gerencia a janela.
- Concentra o acesso ao sistema de arquivos (diálogo de importação a partir da etapa 2).
- Inicia, monitora e encerra o processo Python (etapa 6).
- Repassa mensagens entre o renderer e o Python.

### Preload — `src/preload/`

- Expõe `window.noteflux` pelo `contextBridge`.
- O contrato fica em `src/preload/api.ts`. Cada função é específica, por exemplo `openMidiFile()`,
  e nunca um canal IPC genérico.
- Roda com `sandbox: true`, então só pode importar `electron` (o bundle é gerado pelo electron-vite).

### Renderer — `src/renderer/`

- Interface React.
- A partir da etapa 2: leitura do MIDI.
- A partir da etapa 3: reprodução com Tone.js.
- A partir da etapa 4: piano virtual.
- A partir da etapa 7: geração dos comandos de luz.
- Não tem acesso ao Node.js.

### Python — `python/` _(etapa 5+)_

- `rgb_worker.py` recebe uma mensagem JSON por linha no stdin e responde no stdout.
- Mapeia teclas para LEDs e fala com o OpenRGB.
- Não lê MIDI e não tem relógio próprio.

## Segurança

Configuração do `BrowserWindow`:

| Opção              | Valor   | Motivo                                     |
| ------------------ | ------- | ------------------------------------------ |
| `contextIsolation` | `true`  | Isola o preload do código da página        |
| `nodeIntegration`  | `false` | O renderer não acessa Node.js              |
| `sandbox`          | `true`  | Restringe o preload e o processo da página |

Proteções adicionais:

- A Content-Security-Policy em `src/renderer/index.html` só permite scripts locais.
- Links externos abrem no navegador do sistema (`setWindowOpenHandler`).

## Tempo e sincronização _(etapas 3 a 7)_

- A referência de tempo é o Transport do Tone.js. O piano e os comandos de luz são derivados dele, sem um
  segundo relógio.
- O áudio do Tone.js é agendado com antecedência, e o caminho até o LED (IPC → Python → OpenRGB →
  teclado) tem atraso próprio. Por isso haverá um **offset de latência ajustável** para a luz, calibrado
  na etapa 7.
- Pause e stop apagam as notas do piano e os LEDs acionados pelo app.

## Modo simulado

Sem Python ou sem hardware, os comandos de luz são mostrados na tela em vez de enviados ao teclado. É o
mesmo fluxo, só com outro destino. Isso permite desenvolver sem ter o mesmo teclado.

## Pontos em aberto

- Modelo do teclado e suporte do OpenRGB (controle por tecla ou por zona).
- Mapeamento nota → tecla física → índice de LED. Um piano tem 88 teclas e o layout do teclado não é
  linear.
- Empacotamento do Python junto com o app.
- Samples de piano e licenças.
