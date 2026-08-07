# Botão Judit em lote — igualar a regra ao Judit por contrato

## O que está diferente hoje

Comparei o preenchimento do botão individual (`DistribuicaoTstForm.tsx`, `handleBuscarJudit`) com o do botão em lote (`DistribuicaoTst.tsx`, `handleBulkJudit`). A mesma resposta da Judit produz gravações diferentes:

| Campo / regra | Judit por contrato (correto) | Judit em lote (hoje) |
| --- | --- | --- |
| Tipo de Recurso (geral, reclamante, banco) | Só apaga o valor antigo quando a Judit confirmou a instância TST (`_judit_meta.tribunal_selecionado = TST`); sem TST, preserva o que veio da planilha | Sempre grava `null` quando a Judit não retorna — apaga dado válido mesmo quando só havia TRT |
| Tipo de Recurso Terceiro | Preenchido/normalizado | Nunca tocado |
| Normalização dos tipos de recurso | `normalizarTipoRecurso` (siglas TST: AIRR, RR, AIRE...) | Grava o texto cru da Judit |
| Parte Recorrente | `normalizarParteRecorrente` (RECLAMANTE / BANCO / AMBOS / OUTRA, cruzando com reclamante e reclamada) | Grava o resumo de nomes das partes em `recorrente` |
| Turma / Relator favorabilidade | Classifica automaticamente pelo cadastro TST (`classificarTurmaDB` / `classificarRelatorDB`) e grava posição favorável/desfavorável | Não classifica |
| Dossiê | Preenche quando a Judit retorna | Não preenche |
| Data de distribuição | Grava só `data_distribuicao_real` (preserva a data da planilha) | Sobrescreve também `data_distribuicao` (perde a data da planilha) |
| Campos de julgamento e resultado (`tem_data_julgamento`, `data_julgamento`, `horario`, `tipo_julgamento`, `resultado_*`) | Não são extraídos automaticamente — ficam sob controle do advogado | Gravados automaticamente |
| `erro_judit` | Não é escrito pelo formulário | Reescrito a cada rodada pela regra de "turma oficial" |
| Vínculo com Processos e Casos | Localiza/cria o processo e grava `processo_id` | Não vincula |

## O que fazer

Extrair a regra de preenchimento do formulário para um módulo único (`src/lib/juditPreenchimentoTst.ts`) e fazer o lote consumir exatamente essa função, em vez de manter uma segunda cópia da lógica.

1. Criar `construirPatchJudit(juditData, atual, { turmasTst, relatoresTst })` retornando o patch de `dados_benner` com:
   - normalização de tipos de recurso (incluindo Terceiro) e a regra "só apaga se confirmou TST";
   - `parte_recorrente` normalizado;
   - reclamante / reclamada com a prioridade atual do backend;
   - classificação de Turma e Relator pelo cadastro TST;
   - dossiê, tribunal, relator, turma, situação, processo baixado;
   - trânsito em julgado com a mesma precedência (detecção por movimentação → fallback por situação/baixa);
   - `data_distribuicao_real` apenas;
   - sem campos de julgamento/resultado e sem `erro_judit`.
2. `DistribuicaoTstForm.handleBuscarJudit` passa a usar essa função como fonte do patch (mantendo os efeitos de tela: badges verdes, aviso de "sem recurso", auto-save, anexos, partes).
3. `handleBulkJudit` passa a: carregar os campos atuais necessários da linha, chamar `construirPatchJudit`, gravar o patch pelo `id`, persistir partes, vincular/criar o processo (`find_processo_id_by_numero`) e marcar `judit_preenchido`. Mantém progresso, cancelamento, `com_anexos: false`, throttle de 800 ms e o log em `judit_logs`.
4. Carregar `classificacao_turmas_tst` e `classificacao_relatores_tst` uma única vez antes do laço em lote, para não repetir consulta por processo.

## Detalhes técnicos

- Arquivos: novo `src/lib/juditPreenchimentoTst.ts`; alterações em `src/components/distribuicao-tst/DistribuicaoTstForm.tsx` e `src/pages/DistribuicaoTst.tsx`.
- As funções `normalizarTipoRecurso`, `normalizarParteRecorrente` e os mapas de siglas saem do componente para o novo módulo (mesmo comportamento, só mudam de lugar).
- Nada muda no consumo Judit: o lote continua sem anexos e com uma chamada por processo.

## Verificação

Rodar o lote em uma amostra pequena (5 a 10 processos, via seleção na tela) e conferir que o resultado gravado é idêntico ao de abrir o mesmo processo e clicar no Judit individual: mesmos tipos de recurso, mesma parte recorrente, favorabilidades classificadas, data da planilha preservada e campos de julgamento intactos.
