---
name: Arquivados fora do Total Geral (Distribuição TST)
description: Fichas com situacao_processo 'arquivado' ficam fora de todas as contagens/listas da Distribuição TST; card "Arquivados" e opção de filtro as trazem de volta
type: feature
---
Na Distribuição TST, fichas com `lower(btrim(situacao_processo)) = 'arquivado'` (em `dados_benner`) NÃO entram em nenhuma contagem (Total Geral, A fazer, Prontos, etc.), no relatório "Total por Situação" nem nas listas por padrão.

- O card "Arquivados" (cinza, clicável) mostra a quantidade e aplica `situacaoProcesso='arquivado'` na lista.
- Opção "Arquivados" também existe no select de Situação processo.
- Implementação espelhada em 3 camadas: RPCs `get_distribuicao_tst_stats` (coluna `arquivados` + CTE `ativos` que exclui arquivados, salvo quando o filtro pede) e `get_distribuicao_tst_situacao_totais` (exclusão no WHERE da base); cliente em `useDistribuicoesTst.ts` (helper `applyExclusaoArquivadosPadrao` após cada `applySituacaoProcessoFilter`) e `useDistribuicaoTstStats.ts` (fallback de muitos IDs).
- PostgREST usa `situacao_processo.ilike.arquivado*` (cobre 'Arquivado', 'ARQUIVADO', 'arquivado ' com espaço).
- RPCs são SECURITY DEFINER com EXECUTE revogado de PUBLIC/anon (só authenticated) — a ferramenta de leitura anônima não consegue executá-las.
