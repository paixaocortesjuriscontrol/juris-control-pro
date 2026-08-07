# Botão Judit em lote — igualar a regra ao Judit por contrato

## O que está diferente hoje

Comparei o preenchimento do botão individual (`DistribuicaoTstForm.tsx`, `handleBuscarJudit`) com o do botão em lote (`DistribuicaoTst.tsx`, `handleBulkJudit`). A mesma resposta da Judit produz gravações diferentes:

Li integralmente o `handleBuscarJudit` do formulário (`DistribuicaoTstForm.tsx:835-1217`) e o `handleBulkJudit` (`DistribuicaoTst.tsx:1196-1397`). São 14 divergências:

| # | Campo / regra | Judit por contrato (correto) | Judit em lote (hoje) |
| --- | --- | --- | --- |
| 1 | Tipo de Recurso (geral, reclamante, banco) | `applyJuditOnly`: só apaga o valor antigo quando a Judit confirmou a instância TST (`_judit_meta.tribunal_selecionado = TST`); sem TST, preserva o valor da planilha | Sempre grava `null` quando a Judit não retorna — apaga dado válido mesmo quando só havia TRT |
| 2 | Tipo de Recurso Terceiro | Preenchido e normalizado | Nunca tocado |
| 3 | Normalização dos tipos de recurso | `normalizarTipoRecurso`: siglas (AIRR, ARR, RR, ED-RR, RO, RE...), composições com `+`, mapa de valores legados | Grava o texto cru da Judit |
| 4 | Parte Recorrente | `normalizarParteRecorrente` → Reclamante / Reclamada / Reclamante e Reclamada / Terceiro, comparando tokens com reclamante e reclamada | Grava em `recorrente` o resumo de **nomes** das partes (`getJuditPartesResumo`) |
| 5 | Turma — favorabilidade | `classificarTurmaDB` contra `classificacao_turmas_tst` → `turma_favorabilidade` POSITIVA/NEGATIVA | Não classifica |
| 6 | Relator — favorabilidade | `classificarRelatorDB` contra `classificacao_relatores_tst` → `relator_favorabilidade` POSITIVO/NEGATIVO | Não classifica |
| 7 | Dossiê | Preenche quando a Judit retorna | Não preenche |
| 8 | Data de distribuição | Grava **só** `data_distribuicao_real` | Grava `data_distribuicao_real` **e** sobrescreve `data_distribuicao` |
| 9 | Tribunal | Aceita o tribunal devolvido pela Judit (inclusive TRT) | Só aceita TST/STF/STJ; qualquer outro é descartado |
| 10 | Processo baixado | Normaliza para maiúsculas (`S`/`N`) | Grava o valor cru |
| 11 | Campos de julgamento e resultado (`tem_data_julgamento`, `data_julgamento`, `horario_julgamento`, `tipo_julgamento`, `resultado_*`) | Removidos de propósito — "não extraímos mais automaticamente", ficam sob controle da advogada | Gravados automaticamente pela Judit |
| 12 | `erro_judit` | Nunca escrito pelo formulário | Reescrito em toda rodada pela regra de "turma oficial" (`1ª a 8ª Turma`) |
| 13 | Vínculo com Processos e Casos | Resolve `processo_id` por `processos.numero` e, no fallback, pela RPC `find_processo_id_by_numero` | Não vincula |
| 14 | Partes do processo | `persistirPartesJudit` (regra única e compartilhada) + invalidação do cache da aba Partes | Faz delete + insert próprio, com subconjunto de campos |

Também há duas diferenças de comportamento (não de campo) que valem manter conscientes:

- O individual **pré-salva** o que a advogada digitou antes de chamar a Judit e só grava quando algum campo foi realmente preenchido; o lote grava sempre e marca `judit_preenchido` mesmo quando o update foi bloqueado por RLS ou nada mudou.
- O individual usa `force_refresh` e mostra a origem da resposta (cache / outra instância); o lote sempre usa a resposta padrão, o que é correto para volume.

## Data de distribuição — o que a advogada está vendo

Confirmei nos dois caminhos:

- No botão por contrato (`DistribuicaoTstForm.tsx:1058`), a data da Judit é gravada **apenas** em `data_distribuicao_real`, via `apply` — só quando a Judit devolve uma data; se não devolve, o valor existente é preservado.
- No lote (`DistribuicaoTst.tsx:1318-1320`), a mesma data é gravada em `data_distribuicao_real` **e** em `data_distribuicao`, mexendo numa coluna que o individual não toca.
- O lote ainda monta a chamada usando `data_distribuicao_real || data_distribuicao_planilha` como data de referência (`DistribuicaoTst.tsx:1131`), o que o individual não faz.

Correção: no lote, gravar somente `data_distribuicao_real`, exatamente como no individual, sem tocar `data_distribuicao` nem `data_distribuicao_planilha`.

A causa exata do relato ("no lote não funciona") ainda não está confirmada — pode ser essa divergência de coluna ou processos em que a Judit realmente não retorna data. Primeiro passo da implementação: rodar o lote em 3 a 5 processos indicados pela advogada e registrar, por processo, o que a Judit devolveu e o que foi gravado.

## O que fazer

Extrair a regra de preenchimento do formulário para um módulo único (`src/lib/juditPreenchimentoTst.ts`) e fazer o lote consumir exatamente essa função, em vez de manter uma segunda cópia da lógica.

1. Criar `construirPatchJudit(juditData, atual, { turmasTst, relatoresTst })` reunindo, num só lugar, todas as 14 regras acima:
   - tipos de recurso normalizados (geral, reclamante, banco, terceiro) com a regra "só apaga se confirmou TST" (itens 1 a 3);
   - `parte_recorrente` normalizado para as 4 opções fixas (item 4);
   - reclamante / reclamada com a prioridade do backend e fallback por `tipo_pessoa` (nunca por polo ACTIVE/PASSIVE);
   - classificação de Turma e Relator pelo cadastro TST (itens 5 e 6);
   - dossiê, tribunal (sem restrição a TST/STF/STJ), relator, turma, situação, processo baixado em maiúsculas (itens 7, 9, 10);
   - trânsito em julgado com a mesma precedência: detecção por movimentação → fallback por situação/baixa, incluindo `data_transito_julgado`;
   - `data_distribuicao_real` apenas (nunca `data_distribuicao` nem `data_distribuicao_planilha`) (item 8);
   - **sem** campos de julgamento/resultado e **sem** `erro_judit` (itens 11 e 12).
2. `DistribuicaoTstForm.handleBuscarJudit` passa a usar essa função como fonte do patch, mantendo os efeitos de tela: badges verdes dos campos preenchidos, aviso "Judit não confirmou recurso", espelho no bloco Fechamento (`bennerExtra`), anexos e auto-save.
3. `handleBulkJudit` passa a: carregar os campos atuais da linha, chamar `construirPatchJudit`, gravar o patch pelo `id`, chamar `persistirPartesJudit` (item 14), resolver `processo_id` com o mesmo fallback de RPC (item 13) e marcar `judit_preenchido` **somente** quando o update foi confirmado. Mantém progresso, cancelamento, `com_anexos: false`, throttle de 800 ms e o log em `judit_logs`.
4. Carregar `classificacao_turmas_tst` e `classificacao_relatores_tst` uma única vez antes do laço, para não repetir consulta por processo.

## Detalhes técnicos

- Arquivos: novo `src/lib/juditPreenchimentoTst.ts`; alterações em `src/components/distribuicao-tst/DistribuicaoTstForm.tsx` e `src/pages/DistribuicaoTst.tsx`.
- As funções `normalizarTipoRecurso`, `normalizarParteRecorrente`, `normalizarValorPorCampo`, os mapas `SIGLAS_RECURSO`, `OPCOES_RECURSO_NORM` e `ALTERACOES_LEGADAS` saem do componente para o novo módulo (mesmo comportamento, só mudam de lugar) — o preenchimento por IA continua usando as mesmas funções.
- `getJuditPartesResumo` deixa de alimentar `recorrente` no lote; se ainda for útil como texto informativo, fica só na exibição.
- `erro_judit` deixa de ser reescrito pelo lote. Se a marcação de "turma fora do padrão TST" for desejada, ela deve virar regra única aplicada nos dois botões — decisão a confirmar com você.
- Nada muda no consumo Judit: o lote continua sem anexos e com uma chamada por processo.

## Verificação

Rodar o lote em uma amostra pequena (5 a 10 processos, via seleção na tela) e conferir que o resultado gravado é idêntico ao de abrir o mesmo processo e clicar no Judit individual: mesmos tipos de recurso, mesma parte recorrente, favorabilidades classificadas, Data Real igual, Data Planilha intacta e campos de julgamento preservados.
