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
- O contrato fica em `src/preload/api.ts`. Cada função é específica e tipada, nunca um canal IPC genérico.
- Funções expostas:
  - `openMidiFile()`: invoca o canal IPC `midi:open` no processo principal para abrir o seletor de arquivos, retornando os bytes do MIDI (`Uint8Array`) e o nome do arquivo, erro tratado (`too_large` ou `read_failed`) ou `null` em caso de cancelamento.
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
- Pause e stop apagam as notas do piano e liberam os LEDs acionados pelo app (ver
  [Teclas protegidas e restauração](#teclas-protegidas-e-restauração)).

## Teclado de iluminação

O teclado iluminado é o **teclado do computador** (teclado gamer RGB), não um teclado musical. Algumas
teclas fazem o papel de teclas do piano e acendem conforme as notas.

### Do MIDI ao LED

```
nota MIDI ──(renderer: mapeamento de notas)──▶ código de tecla ──(Python: keymap)──▶ índice de LED
   60                                            "KeyA"                                    37
```

- O vocabulário comum entre os dois lados são os **códigos físicos de tecla** no padrão do
  `KeyboardEvent.code` do navegador (`KeyA`, `Digit1`, `Escape`, `Enter`, `IntlRo`…). Eles não dependem
  do idioma do teclado.
- O **renderer** decide qual tecla representa cada nota. Notas fora da faixa disponível são trazidas
  para dentro dela (mesma nota em outra oitava). A regra exata será definida na etapa 7.
- O **Python** converte o código de tecla no índice de LED do dispositivo.

### Formatos e padrões físicos

Predefinições de **formato**: 60%, 65%, 75%, TKL e 100%, além de **Personalizado**. Predefinições de
**padrão físico**: ABNT2 (com `Ç` e a tecla `IntlRo` ao lado do Shift direito) e ANSI/US.

O formato e o padrão dizem **quais teclas existem**. Eles definem a faixa de notas possível e o desenho do
teclado no modo simulado. **Não** dizem qual LED fica em cada tecla, porque isso varia por modelo.

### Keymap e testador de LEDs

O mapa entre código de tecla e índice de LED fica em um arquivo `keymap.json` por teclado. Ele é obtido
assim:

1. **Automático.** Se o OpenRGB informar o nome de cada LED (`Key: A`, `Key: Enter`…), o mapa é montado
   a partir desses nomes.
2. **Testador.** Se não houver nomes, o script `python/tools/keymap_probe.py` acende um LED por vez, a
   pessoa aperta a tecla que acendeu e o script grava o par LED ↔ tecla.

O testador entra na **etapa 5**, como script de terminal independente do Electron. Uma versão dentro do
app fica para depois do MVP. O formato do `keymap.json` será documentado em `docs/protocol.md`.

### Teclas protegidas e restauração

- **Teclas protegidas** nunca são acesas pelo app e mantêm a iluminação normal. Padrão: Esc, Enter,
  Backspace, Tab, Shift, Ctrl, Alt, Win, Espaço e setas. A lista é configurável.
- A regra vale nos dois lados: o mapeamento do renderer não usa teclas protegidas, e o Python ignora
  qualquer comando para elas (trava de segurança).
- Ao parar, as teclas acionadas pelo app voltam à iluminação anterior quando o dispositivo permitir. Se
  não for possível restaurar, elas são apagadas. Isso deve ser verificado na etapa 5.
- Softwares de fabricante (Synapse, G Hub, iCUE etc.) podem disputar o controle dos LEDs com o OpenRGB. O
  comportamento deve ser testado e documentado no README.

## Configurações

Tela de configurações onde cada pessoa ajusta o app ao próprio teclado. Campos previstos:

| Grupo      | Campo              | Valores                                        |
| ---------- | ------------------ | ---------------------------------------------- |
| Teclado    | Formato            | 60%, 65%, 75%, TKL, 100%, Personalizado        |
| Teclado    | Padrão físico      | ABNT2, ANSI/US                                 |
| Teclado    | Teclas protegidas  | Lista editável (padrão acima)                  |
| Teclado    | Keymap de LEDs     | Automático (OpenRGB) ou arquivo `keymap.json`  |
| Iluminação | Destino            | Simulado ou OpenRGB                            |
| Iluminação | Dispositivo        | Lista de dispositivos encontrados pelo OpenRGB |
| Iluminação | Ajuste de latência | Milissegundos, positivo ou negativo            |

- **Persistência:** o main grava `settings.json` na pasta de dados do app (`app.getPath('userData')`). O
  renderer lê e salva pelas funções tipadas do preload, nunca pelo sistema de arquivos.
- O Python recebe do main o que precisa (keymap, teclas protegidas, dispositivo) por mensagem do
  protocolo. Ele não lê o `settings.json` diretamente.
- **Entrada por etapas:** a tela começa com Formato, Padrão físico e Teclas protegidas quando o modo
  simulado entrar. Os campos de iluminação real (dispositivo, keymap, latência) entram nas etapas 6 e 7.

## Modo simulado

Sem Python ou sem hardware, os comandos de luz são mostrados na tela, num desenho do teclado configurado,
em vez de enviados ao dispositivo. É o mesmo fluxo, só com outro destino. Isso permite desenvolver sem ter
o mesmo teclado.

## Pontos em aberto

- Modelo do teclado e suporte do OpenRGB (controle por tecla ou por zona, nomes dos LEDs).
- Regra de mapeamento nota → tecla e tratamento de notas fora da faixa.
- Se o dispositivo permite restaurar a iluminação anterior.
- Empacotamento do Python junto com o app.
- Samples de piano e licenças.
