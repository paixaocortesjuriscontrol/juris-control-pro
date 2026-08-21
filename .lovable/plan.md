# Distribuição TST: filtro CEJUSC e ajuste do "A fazer"

## O que muda

1. **Nova opção "CEJUSC"** no filtro "Situação processo" (ao lado de Ativo, Trânsito em Julgado, Outros, Processo outro escritório, Segredo de Justiça, A fazer). Ao selecionar, lista somente os registros marcados como CEJUSC.
2. **"A fazer" deixa de contar CEJUSC**: processos marcados como CEJUSC passam a entrar em "Não precisa fazer", igual a Trânsito em Julgado, Segredo de Justiça e Processo de outro escritório. Isso vale tanto para o card/contador quanto para o filtro "A fazer" e para o contador de "Prontos sem pendência".

Nada mais na tela é alterado (colunas, badges, relatórios e demais filtros permanecem iguais).

## Detalhes técnicos

O campo já existe na base: `dados_benner.cejusc` (boolean), hoje usado apenas pelo cálculo de pendências (`src/utils/distribuicaoTstPendencias.ts`) e pelo badge da lista.

Frontend:
- `src/pages/DistribuicaoTst.tsx`: novo `SelectItem value="cejusc"` no filtro Situação processo.
- `src/hooks/useDistribuicoesTst.ts`: adicionar `"cejusc"` ao tipo `situacaoProcesso`; nas três montagens de query (lista, contagem e `fetchAllDistribuicaoTstIds`) tratar `cejusc` (`.eq("cejusc", true)`), acrescentar `cejusc.is.null,cejusc.eq.false` ao ramo `a_fazer` e `cejusc.eq.true` ao ramo `nao_precisa_fazer`.
- `src/hooks/useDistribuicaoTstStats.ts`: no cálculo local, `aFazer` exige `row.cejusc !== true` e `naoPrecisaFazer` inclui `row.cejusc === true`.
- `src/hooks/useProntoSemPendenciaCount.ts`: incluir `cejusc === true` na condição `naoPrecisaFazer` (e no select de colunas, se ainda não estiver).

Banco (migração, `CREATE OR REPLACE`):
- `get_distribuicao_tst_stats` e `get_distribuicao_tst_situacao_totais`: no bloco do filtro `v_situacao`, adicionar `v_situacao = 'cejusc' AND db.cejusc = true`, e incluir `db.cejusc IS DISTINCT FROM true` no ramo `a_fazer`; nas agregações, o `COUNT(... a_fazer)` passa a excluir `cejusc = true` (a coluna `cejusc` já é retornada e continua contando à parte).

## Verificação

Comparar, para um mesmo período, `A fazer + Não precisa fazer` antes e depois: o total geral deve permanecer, com os CEJUSC migrando de um card para o outro; e o filtro "CEJUSC" deve trazer exatamente a quantidade do card CEJUSC.
