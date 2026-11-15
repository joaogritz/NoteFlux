# Tarefa: Etapa 4 — Piano virtual sincronizado

> Briefing para o agente que vai implementar (Antigravity, Claude ou outro).
> **Antes de começar, leia o `CLAUDE.md` inteiro.** As regras dele valem para esta tarefa.

## Antes de tudo: a etapa 3 está de pé?

A etapa 3 foi testada com som no Windows e está na `main`. Não é preciso refazer a tabela inteira. Antes de
mexer no código, rode `npm install` e `npm run dev`, importe `teste-escala.mid` e confirme em um minuto que
**tocar, pausar, continuar e parar** funcionam. Se algo falhar, pare e relate antes de seguir.

## Objetivo

Um piano de 88 teclas na parte de baixo da janela. Enquanto a música toca, as teclas das notas que estão
soando ficam acesas, **no mesmo instante em que o som é ouvido**.

**Esta etapa não tem nada de RGB, modo simulado de iluminação ou configurações.**

## Branch

Criar `etapa-4/piano-virtual` a partir da `main` atualizada. Um único pull request no fim.

## Decisões já tomadas

1. **88 teclas fixas**, de Lá0 (MIDI 21) a Dó8 (MIDI 108), como um piano acústico. Notas fora dessa faixa
   não aparecem.
2. **As teclas acesas são calculadas a partir da posição do Transport**, a cada quadro: uma nota está acesa
   quando `note.time <= posição < note.time + note.duration`. Não usar eventos de liga/desliga com
   `Tone.getDraw()`: o Draw não roda com a janela minimizada e descarta eventos atrasados, o que deixaria
   teclas presas. Calculando pela posição, o piano está sempre certo, inclusive depois de pausar, parar ou
   restaurar a janela.
3. **Posição audível, não a posição agendada.** `Transport.seconds` é a posição em `Tone.now()`, que fica
   cerca de 0,1 s **à frente** do som (lookahead do Tone.js). Para a tela, usar a posição no instante atual
   do áudio: `transport.getSecondsAtTime(Tone.immediate())`. O piano e o tempo na tela passam a usar essa
   mesma posição.
4. **Percussão não aparece no piano**, como já não toca.
5. **Uma cor só** para as teclas acesas (a cor de destaque do app). Cor por trilha fica para depois.
6. **Piano só para ver.** Clicar nas teclas não toca nada.

## O que fazer

### 1. Player — `src/renderer/src/playback/player.ts`

- `getPositionSeconds()` passa a devolver a posição audível (decisão 3), ainda limitada entre 0 e a duração e
  0 quando parado.
- Nenhuma outra mudança de comportamento no player.

### 2. Notas ativas — `src/renderer/src/piano/activeNotes.ts`

Funções puras, sem React e sem Tone.js:

```ts
export interface NoteTimeline {
  /** Notas tocáveis (sem percussão), ordenadas por início. */
  notes: { midi: number; start: number; end: number }[]
  /** Maior duração de nota, para limitar a busca. */
  maxDuration: number
}

export function buildNoteTimeline(midi: Midi): NoteTimeline
export function getActiveNotes(timeline: NoteTimeline, positionSeconds: number): Set<number>
```

- `getActiveNotes` deve ser eficiente para arquivos longos: busca binária pelo primeiro `start` maior que a
  posição e varredura para trás só até `posição - maxDuration`. Nada de percorrer o arquivo inteiro a cada
  quadro.
- Uma nota que começa exatamente em `end` de outra da mesma tecla (notas repetidas) deve continuar acesa,
  sem piscar apagada por um quadro.

### 3. Desenho do teclado — `src/renderer/src/piano/`

- `pianoLayout.ts` (puro): para cada nota de 21 a 108, se é branca ou preta e a posição horizontal. São 52
  teclas brancas e 36 pretas. Posições em porcentagem da largura, para o piano esticar com a janela.
- `Piano.tsx`: recebe `activeNotes: ReadonlySet<number>` e desenha as teclas com `div`s (brancas lado a lado,
  pretas por cima, mais curtas e estreitas). Sem canvas, sem biblioteca nova.
- Rótulo pequeno em cada Dó (`C1`…`C8`, com `C4` = Dó central), para se orientar.
- Tecla acesa: preenchida com a cor de destaque. Funciona igual para brancas e pretas.
- Com a janela no tamanho mínimo (720 px), todas as 88 teclas cabem sem rolagem horizontal.

### 4. Interface — `App.tsx` e `main.css`

- O piano fica sempre visível, ocupando a largura da janela, na parte de baixo. Sem MIDI carregado, ele aparece
  apagado.
- O laço de `requestAnimationFrame` que já atualiza a posição passa a calcular também as notas ativas, com a
  mesma posição. Atualizar o estado do React **só quando o conjunto de notas mudar**, não a cada quadro.
- Pausar e parar apagam todas as teclas (o laço para e o conjunto fica vazio). Ao continuar, as notas da
  posição atual acendem de novo.
- Trocar de arquivo, importar um arquivo inválido ou chegar ao fim: piano apagado.
- O resto da tela continua como está. Se o conteúdo não couber em altura, o painel de cima rola, e o piano
  continua fixo embaixo.

### 5. Documentação

- `docs/architecture.md`: seção do Renderer (piano e notas ativas) e seção "Tempo e sincronização" (posição
  audível e por que o piano é calculado pela posição).
- `CLAUDE.md`: "Estado atual" (etapa 4 concluída; próxima é a etapa 5) e "Comandos verificados".
- `README.md`: "Estado atual" e roadmap.

## Fora do escopo

- RGB, modo simulado de iluminação, mapeamento nota → tecla do computador, Python;
- tela de Configurações;
- tocar notas clicando no piano ou com o teclado do computador;
- cores por trilha, "notas caindo" (estilo Synthesia), partitura;
- zoom, faixa de teclas configurável, piano com menos de 88 teclas;
- barra de busca/arraste, velocidade, transposição.

## Como testar

| Teste                                                 | Resultado esperado                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Abrir o app sem MIDI                                  | Piano de 88 teclas embaixo, todo apagado, sem rolagem horizontal                                                  |
| `teste-escala.mid` → Tocar                            | Dó3-Mi3-Sol3 acesos de 0 a 2 s, depois Sol2-Si2-Ré3 até 4 s. Na melodia, de Dó4 a Dó5, uma tecla por vez, subindo |
| Observar e ouvir ao mesmo tempo                       | A tecla acende junto com o som, nem antes nem depois de forma perceptível                                         |
| Pausar no meio                                        | Todas as teclas apagam                                                                                            |
| Continuar                                             | As teclas da posição atual (o acorde, pelo menos) acendem de novo                                                 |
| Parar / fim da música                                 | Piano apagado                                                                                                     |
| `teste-percussao.mid` → Tocar                         | Só Dó4, Ré4, Mi4 e Fá4 acendem. Dó2 e Ré2 (bateria) não                                                           |
| Minimizar no meio da música e restaurar               | As teclas certas para aquele momento estão acesas, nenhuma presa                                                  |
| Importar outro MIDI ou `arquivo-invalido.mid` tocando | Piano apagado                                                                                                     |
| Janela no tamanho mínimo                              | As 88 teclas cabem, rótulos dos Dós legíveis                                                                      |
| Um MIDI real, rápido e com muitas notas               | O piano acompanha sem engasgar o som. Console (F12) sem erros                                                     |

Os testes de sincronia dependem de ver e ouvir de verdade. Se não der, relatar no PR.

## Critérios de pronto

- [ ] Checagem rápida da etapa 3 feita antes de começar
- [ ] `npm run typecheck` e `npm run lint` sem erros
- [ ] Todos os testes da tabela acima passam, **testados de verdade**
- [ ] Nenhuma mudança no main, no preload nem na CSP
- [ ] Teclas acesas calculadas pela posição do Transport, sem segundo relógio e sem Draw
- [ ] `CLAUDE.md`, `docs/architecture.md` e `README.md` atualizados
- [ ] Pull request com: o que mudou, o que foi testado (e em qual sistema) e o que ficou pendente

## Ao terminar

Abrir o pull request e **não** começar a etapa 5. A revisão vem antes.
