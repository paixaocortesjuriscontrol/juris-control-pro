Confirmado: card apenas na tela **Análise DJEN** (`src/pages/AnaliseDjen.tsx`). Não vou tocar em `AnaliseDjenServidor.tsx`.

## Verificação prévia
Busquei em `src/components`, `src/pages` e `src/hooks`. Existem componentes parecidos, mas **nenhum** faz o que você descreveu (comparar execuções do mesmo dia mostrando, por coordenação, quantas publicações a mais cada execução seguinte encontrou):

- `src/components/djen/ExecucoesDoDiaLocalCard.tsx` + hook `useExecucoesDoDiaLocal` — lista execuções do dia com total e "novas vs anterior", mas agregado, sem quebra por coordenação, e filtrado pela coordenação selecionada.
- `src/components/djen/ExecucoesDoDiaCard.tsx` (Servidor) — idem.
- `src/pages/RelatorioExecucoes.tsx` — mostra `djen_runs` do período, mas não compara execuções do mesmo dia por coordenação.

Portanto vou criar um card novo reutilizando as mesmas tabelas usadas hoje (`execucoes_agendadas`, `publicacoes_djen_execucoes`, `publicacoes_djen.execucao_id`, `monitoramentos_djen.coordenacao_id`, `coordenacoes`). Sem migrations.

## Novo hook
`src/hooks/useExecucoesDoDiaPorCoordenacao.ts`

- Recebe `dataYmd` (a data já usada em Análise DJEN: `dataDisponibilizacaoDebounced || dataPublicacaoDebounced`).
- Busca `execucoes_agendadas` (tipos DJEN locais) no intervalo BRT do dia — mesma janela usada por `useExecucoesDoDiaLocal`.
- Busca `publicacoes_djen_execucoes` filtrado por esses `execucao_id`, com join em `publicacoes_djen!inner(id, execucao_id, monitoramento:monitoramentos_djen!inner(coordenacao_id))`, **sem** filtrar por coordenação.
- Busca `coordenacoes(id, nome)` para exibir nomes.
- Agrega em memória:
  - Para cada `(coordenacaoId, execId)`: `total` = nº de publicações vistas naquela execução dentro da coordenação; `novas` = publicações cuja **primeira execução do dia dentro dessa coordenação** é `execId` (comparando com a ordem cronológica das execuções do dia).
- Retorna `{ execucoes: [{ id, iniciado_em, tipoEngine }], linhas: [{ coordenacaoId, nome, celulas: [{ execId, total, novas }] }] }`.

## Novo componente
`src/components/djen/ExecucoesDoDiaAdminCard.tsx`

- Card retraído por padrão (chevron), expande ao clicar no cabeçalho — mesmo padrão visual do `ExecucoesDoDiaLocalCard` (borda indigo, `Sparkles`).
- Cabeçalho: "Execuções do dia por coordenação" + data + badge com nº de execuções.
- Ao expandir, tabela: linhas = coordenações (ordem alfabética), colunas = execuções do dia em ordem cronológica com hora + tipo (Termos/Kurier/Processos). Cada célula mostra `total` e, para execuções após a primeira do dia naquela coordenação, `+N` novas (destacado em verde quando > 0). Rodapé com soma total e soma de "+novas" por execução.
- Só renderiza quando há **2+ execuções** no dia (senão não há comparação).

## Integração em `src/pages/AnaliseDjen.tsx`
- Importar `ExecucoesDoDiaAdminCard`.
- Renderizar logo abaixo do `<ExecucoesDoDiaLocalCard>` (~linha 4107), com guard:
  `{isAdmin && (dataDisponibilizacaoDebounced || dataPublicacaoDebounced) && (<ExecucoesDoDiaAdminCard dataYmd={dataDisponibilizacaoDebounced || dataPublicacaoDebounced} />)}`.
- `isAdmin` já está disponível na página (linha 141, via `useUserRole`). Não-admins não veem o card.

## Fora do escopo
- Sem alterações no card existente nem no `useExecucoesDoDiaLocal`.
- Sem migrations.
- Sem replicar na tela Servidor.
