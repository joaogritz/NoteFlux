# Tarefa: Etapa 3 — Reproduzir MIDI com Tone.js

> Briefing para o agente que vai implementar (Antigravity, Claude ou outro).
> **Antes de começar, leia o `CLAUDE.md` inteiro.** As regras dele valem para esta tarefa.

## Objetivo

Depois de importar um MIDI, a pessoa consegue **tocar, pausar, continuar e parar** a música. O app mostra a
posição atual e a duração (`0:01 / 0:04`).

A referência de tempo é o **Transport do Tone.js**. Tudo o que a interface mostra sobre o tempo é lido dele,
sem um segundo relógio (`setInterval`, `Date.now()`, contador próprio etc.).

**Esta etapa não tem piano virtual nem nada de RGB.**

## Branch

Criar `etapa-3/reproduzir-midi` a partir da `main` atualizada. Um único pull request no fim.

## Decisões já tomadas

1. **Som sintetizado.** Usar `Tone.PolySynth` com `Tone.Synth`. **Não** usar `Tone.Sampler` nem baixar
   samples de piano: licenças e origem dos samples continuam em aberto e a CSP bloqueia conteúdo externo.
2. **Trilhas de percussão não tocam.** Trilhas com `track.instrument.percussion === true` (canal 10 do
   General MIDI) são ignoradas na reprodução, porque bateria tocada como piano soa errado. Elas continuam
   no resumo, marcadas como "percussão, não tocada".
3. **Tempo em segundos.** O `@tonejs/midi` já entrega `note.time` e `note.duration` em segundos, com as
   mudanças de andamento aplicadas. Agendar as notas em segundos e **não** copiar o BPM do arquivo para o
   `Transport.bpm`. Isso aplicaria o andamento duas vezes.
4. **CSP: liberar só workers `blob:`.** O Tone.js cria o relógio interno num Web Worker a partir de um
   `blob:`. A CSP atual bloqueia isso, e o Tone passa a usar `setTimeout`, que o Chromium desacelera quando a
   janela fica em segundo plano, deixando a música com o andamento irregular. Acrescentar **apenas**
   `worker-src 'self' blob:` ao `Content-Security-Policy` de `src/renderer/index.html`. `script-src`
   continua `'self'`.

## O que fazer

### 1. Dependência

- Instalar **apenas** `tone`: `npm install tone` (versão 15.x).
- Nenhuma outra dependência.

### 2. Motor de reprodução — `src/renderer/src/playback/`

Criar `src/renderer/src/playback/player.ts`, sem React, que concentra todo o uso do Tone.js. Sugestão de
contrato:

```ts
export type PlaybackState = 'stopped' | 'playing' | 'paused'

export interface MidiPlayer {
  load(midi: Midi): void // substitui o que estiver carregado e volta para 'stopped'
  unload(): void
  play(): Promise<void> // chama Tone.start() na primeira vez; continua de onde pausou
  pause(): void
  stop(): void // volta para 0:00
  getState(): PlaybackState
  getPositionSeconds(): number // lido de Transport.seconds
  getDurationSeconds(): number
  onStateChange(listener: (state: PlaybackState) => void): () => void
  dispose(): void
}

export function createMidiPlayer(): MidiPlayer
```

Regras:

- **Áudio só depois de um clique.** `await Tone.start()` dentro do clique de tocar, antes do
  `transport.start()`. Sem isso o navegador mantém o `AudioContext` suspenso.
- **Sintetizador:** um `PolySynth(Synth)` ligado ao `destination`, com oscilador `triangle`, envelope curto
  (ataque ~5 ms, release ~0,4 s), `maxPolyphony = 64` e volume em torno de `-8 dB` para não distorcer com
  acordes.
- **Agendamento:** um `Tone.Part` com as notas de todas as trilhas tocáveis. No callback, usar o `time`
  recebido: `synth.triggerAttackRelease(note.name, note.duration, time, note.velocity)`. Nunca usar
  `Tone.now()` nem o horário atual no callback.
- **Fim da música:** `transport.scheduleOnce` em `midi.duration`. Atualizações de estado que chegam à
  interface passam por `Tone.getDraw().schedule(callback, time)`, nunca direto do callback de áudio.
  Ao terminar, o estado volta a `'stopped'` e a posição a `0:00`.
- **Pause:** `transport.pause()` e `synth.releaseAll()`. Nenhuma nota pode ficar soando.
- **Continuar:** `transport.start()` segue da posição pausada. Uma nota que já tinha começado antes do pause
  não é retomada. Isso é esperado nesta etapa.
- **Stop:** `transport.stop()`, `synth.releaseAll()` e posição em 0.
- **Trocar de arquivo (`load`) e `unload`:** parar, descartar o `Part` antigo (`dispose()`) e limpar os
  eventos do Transport (`transport.cancel(0)`) antes de agendar o novo arquivo.
- **`dispose`:** parar e liberar o `Part`, o sintetizador e os eventos agendados.
- Duração zero ou MIDI sem notas tocáveis: `play()` não faz nada e a interface mantém os botões
  desabilitados.

### 3. Interface — `App.tsx`

- Criar o player uma vez, guardado num `useRef`, e chamar `dispose()` no cleanup de um `useEffect`.
  Atenção: o `StrictMode` monta, desmonta e monta de novo em desenvolvimento. O player precisa funcionar
  depois desse ciclo, sem som duplicado nem erro de objeto já descartado.
- Ao importar com sucesso, chamar `player.load(midi)`. Se a importação seguinte der erro (o resumo some),
  chamar `player.unload()`.
- Controles, abaixo do resumo, visíveis só com um MIDI carregado:
  - botão **Tocar** / **Pausar** (o mesmo botão alterna conforme o estado);
  - botão **Parar**, desabilitado quando já está parado;
  - posição e duração no formato `m:ss / m:ss`, reaproveitando `formatDuration`;
  - opcional: uma barra de progresso **somente leitura** (`<progress>`). Sem busca/arraste.
- A posição é atualizada com `requestAnimationFrame` **lendo** `player.getPositionSeconds()`. O laço roda
  só enquanto toca e é cancelado ao pausar, parar ou desmontar.
- Durante o "Carregando…" da importação, os controles ficam desabilitados.
- Na tabela de trilhas, trilhas de percussão mostram o complemento "percussão, não tocada".
- Erro ao iniciar o áudio (`Tone.start()` falhar): "Não foi possível iniciar o áudio." O resumo continua na
  tela.
- Manter o visual atual (`main.css`). Sem biblioteca de UI nova.

### 4. CSP — `src/renderer/index.html`

- Acrescentar `worker-src 'self' blob:` (ver decisão 4). Nenhuma outra mudança na política.

### 5. Documentação

- `docs/architecture.md`:
  - seção do Renderer: o motor em `src/renderer/src/playback/player.ts`, o uso do Transport como relógio e
    a regra de percussão;
  - seção Segurança: registrar `worker-src 'self' blob:` e o motivo.
- `CLAUDE.md`: "Estado atual" (etapa 3 concluída; próxima é a etapa 4) e "Comandos verificados" com o que
  foi testado de fato e em qual sistema.
- `README.md`: o bloco "Estado atual" ainda diz etapa 1. Atualizar para etapa 3 e marcar as etapas 2 e 3 no
  roadmap como concluídas.

## Fora do escopo

Não fazer nesta tarefa:

- piano virtual ou qualquer desenho de teclas;
- RGB, modo simulado de iluminação, Python;
- tela de Configurações;
- barra de busca/arraste, velocidade de reprodução, transposição, metrônomo, loop;
- volume ajustável, mute ou solo por trilha;
- samples de piano, `Tone.Sampler`, download de qualquer recurso;
- atalhos de teclado (inclusive Espaço para tocar/pausar);
- arrastar e soltar arquivos, arquivos recentes.

## Como testar

Arquivos em `assets/midi/` (`teste-tempo.mid` e `teste-percussao.mid` foram criados para esta etapa):

| Teste                                                | Resultado esperado                                                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `teste-escala.mid` → Tocar                           | Escala de Dó a Dó (8 notas, uma a cada 0,5 s) sobre acorde de Dó maior e depois Sol maior. Termina em 0:04, volta a "Tocar" e a **0:00** |
| Pausar no meio e esperar 2 s                         | Silêncio total, nenhuma nota presa, posição parada                                                                                       |
| Continuar                                            | Segue da mesma posição, sem repetir as notas anteriores                                                                                  |
| Parar no meio e tocar de novo                        | O som para na hora (só o fim natural da nota, menos de 0,5 s), 0:00; ao tocar, recomeça do início                                        |
| `teste-tempo.mid` → Tocar                            | Resumo com duração 0:06. 4 notas rápidas (0,5 s) e depois 4 lentas (1 s), cada nota no seu tempo, sem atropelar nem esticar              |
| `teste-percussao.mid` → Tocar                        | Só as 4 notas do "Piano" soam. "Bateria" aparece na tabela como "percussão, não tocada"                                                  |
| Importar outro MIDI enquanto toca                    | O som para, o novo resumo aparece parado em 0:00 e toca normalmente                                                                      |
| Importar `arquivo-invalido.mid` enquanto toca        | O som para, aparece o erro de leitura e o app continua funcionando                                                                       |
| Tocar e deixar a janela em segundo plano/minimizada  | O andamento continua regular                                                                                                             |
| DevTools (F12) → Console durante os testes acima     | Nenhum erro de CSP, nenhum "Max polyphony exceeded", nenhum erro de objeto descartado                                                    |
| Um MIDI real de piano, com vários minutos (opcional) | Toca até o fim, posição coerente com a duração                                                                                           |

Os testes de som dependem de ouvir de verdade. Se não der para ouvir (máquina sem áudio, display virtual),
relatar isso no PR em vez de marcar como testado.

## Critérios de pronto

- [ ] `npm run typecheck` sem erros
- [ ] `npm run lint` sem erros
- [ ] `npm run dev` abre o app e todos os testes da tabela acima passam, **testados de verdade e ouvidos**
- [ ] Nenhuma função nova no preload e nenhuma mudança no main
- [ ] Única mudança de segurança: `worker-src 'self' blob:` na CSP
- [ ] Nenhum relógio paralelo: a posição na tela vem de `Transport.seconds`
- [ ] `CLAUDE.md`, `docs/architecture.md` e `README.md` atualizados
- [ ] Pull request com: o que mudou, o que foi testado (e em qual sistema) e o que ficou pendente

## Ao terminar

Abrir o pull request e **não** começar a etapa 4. A revisão vem antes.
