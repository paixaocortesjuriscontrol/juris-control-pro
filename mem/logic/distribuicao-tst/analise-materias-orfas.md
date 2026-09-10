---
name: Análise por matéria sem órfãs
description: Itens de materias_analise_* só valem se a matéria ainda estiver em materias_recurso_*; órfãs não geram aviso/pendência nem exportam
type: feature
---
Regra: em `dados_benner`, as listas JSONB `materias_analise_reclamante/banco/terceiro` podem conter matérias removidas pela advogada (resíduo). Sempre filtrar pelo campo de seleção correspondente (`materias_recurso_*`, split por `;`/nova linha, comparação sem acento/minúsculas) via `itensAnaliseSelecionados` em `src/utils/distribuicaoTstPendencias.ts`.

Usado em: avisos/pendências (fora da lista oficial e fora da lista do dossiê), geração da Carga Benner e poda ao salvar a ficha. Sem isso, matérias fantasmas geram "Verificar (não conta como pendência)" que a tela nem mostra.
