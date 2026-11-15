# Tarefa: Etapa 2 — Importar e ler MIDI

> Briefing para o agente que vai implementar (Antigravity, Claude ou outro).
> **Antes de começar, leia o `CLAUDE.md` inteiro.** As regras dele valem para esta tarefa.

## Objetivo

O botão **Importar MIDI** abre o seletor de arquivos. O app lê o `.mid/.midi` escolhido e mostra um resumo:
nome do arquivo, duração, número de trilhas e quantidade de notas, total e por trilha.

**Esta etapa não toca som.**

## Branch

Criar `etapa-2/importar-midi` a partir da `main` atualizada. Um único pull request no fim.

## O que fazer

### 1. Dependência

- Instalar **apenas** `@tonejs/midi`: `npm install @tonejs/midi`
- **Não** instalar `tone` (Tone.js). Ele entra na etapa 3.

### 2. Processo principal — `src/main/`

- Registrar um handler `ipcMain.handle('midi:open', …)`. De preferência, num arquivo próprio, por exemplo
  `src/main/midiFile.ts`, chamado a partir do `index.ts`.
- O handler:
  1. abre `dialog.showOpenDialog` com a janela como pai, `properties: ['openFile']` e o filtro
     `{ name: 'Arquivos MIDI', extensions: ['mid', 'midi'] }`;
  2. se a pessoa cancelar, retorna `null`;
  3. se o arquivo tiver mais de **10 MB**, retorna um erro tratado (não lança exceção sem controle);
  4. lê o arquivo com `fs.promises.readFile` e retorna `{ fileName, data }`. `fileName` é só o nome, sem
     o caminho completo. `data` é um `Uint8Array`.
- **Não** fazer a leitura musical do MIDI no main. O main só entrega os bytes.

### 3. Preload — `src/preload/`

- Em `api.ts`, tipar a função e os tipos de retorno. Sugestão:

  ```ts
  export interface MidiFileData {
    fileName: string
    data: Uint8Array
  }

  export type OpenMidiResult =
    { ok: true; file: MidiFileData } | { ok: false; error: 'too_large' | 'read_failed' } | null // cancelado

  export interface NoteFluxApi {
    openMidiFile(): Promise<OpenMidiResult>
  }
  ```

- Em `index.ts`, implementar `openMidiFile` com `ipcRenderer.invoke('midi:open')`.
- **Não** expor `ipcRenderer`, `invoke` genérico ou qualquer outro canal.
- Não mexer em `contextIsolation`, `nodeIntegration` nem `sandbox`.

### 4. Leitura do MIDI — renderer

- Criar `src/renderer/src/midi/parseMidi.ts` com uma função pura, que recebe os bytes e devolve o
  objeto `Midi` do `@tonejs/midi` e um resumo:

  ```ts
  interface MidiSummary {
    durationSeconds: number
    trackCount: number
    totalNotes: number
    tracks: { index: number; name: string; noteCount: number }[]
  }
  ```

- Trilha sem nome → exibir `Trilha N`, começando em 1.
- Se o `@tonejs/midi` lançar erro, a função lança um erro próprio, tratado na interface.
- Guardar o objeto `Midi` no estado do React. Ele será usado na etapa 3, mas **não** implementar
  reprodução agora.

### 5. Interface — `App.tsx`

- O botão chama `window.noteflux.openMidiFile()`.
- Enquanto lê, desabilitar o botão e mostrar "Carregando…".
- Com sucesso, mostrar:
  - o nome do arquivo;
  - a duração no formato `m:ss`;
  - o número de trilhas;
  - o total de notas;
  - uma lista ou tabela com cada trilha: nome e número de notas.
- Mensagens de erro, em português, no lugar do aviso atual:
  - arquivo grande demais: "O arquivo passa de 10 MB.";
  - falha de leitura ou MIDI inválido: "Não foi possível ler este arquivo MIDI.".
- Se a pessoa cancelar, nada muda na tela.
- Importar outro arquivo substitui o anterior.
- Manter o visual atual (`main.css`). Ajustes de layout são permitidos, sem biblioteca de UI nova.

### 6. Documentação

- `docs/architecture.md`: na seção do preload, listar a função `openMidiFile` e o canal `midi:open`.
- `CLAUDE.md`: atualizar "Estado atual" (etapa 2 concluída; próxima é a etapa 3) e a tabela "Comandos
  verificados" com o que foi testado de fato e em qual sistema.

## Fora do escopo

Não fazer nesta tarefa:

- som, Tone.js, play/pause/stop;
- piano virtual;
- arrastar e soltar arquivos, arquivos recentes;
- tela de Configurações;
- qualquer coisa de Python ou RGB.

## Como testar

Arquivos de teste em `assets/midi/`:

| Teste                                   | Resultado esperado                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| Importar `teste-escala.mid`             | Duração **0:04** · **2** trilhas · **14** notas · "Melodia" 8 notas · "Acordes" 6 notas |
| Abrir o seletor e cancelar              | Nada muda                                                                               |
| Importar `arquivo-invalido.mid`         | "Não foi possível ler este arquivo MIDI." e o app continua funcionando                  |
| Importar outro MIDI depois de um válido | O resumo é substituído                                                                  |
| Um MIDI real qualquer (opcional)        | Resumo coerente com o arquivo                                                           |

## Critérios de pronto

- [ ] `npm run typecheck` sem erros
- [ ] `npm run lint` sem erros
- [ ] `npm run dev` abre o app e todos os testes da tabela acima passam, **testados de verdade**
- [ ] Nenhuma função nova no preload além de `openMidiFile`
- [ ] `CLAUDE.md` e `docs/architecture.md` atualizados
- [ ] Pull request com: o que mudou, o que foi testado (e em qual sistema) e o que ficou pendente

## Ao terminar

Abrir o pull request e **não** começar a etapa 3. A revisão vem antes.
