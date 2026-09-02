---
name: Pendências da Distribuição TST espelham as rejeições da Carga Benner
description: Tipo de recurso fora da lista oficial e dossiê fora do padrão passam a gerar pendência na lista, além de rejeitar na Carga Benner
type: feature
---
Regra (2026-09-02): tudo que rejeita a linha na Carga Benner deve aparecer como pendência na lista/kanban/relatório da Distribuição TST, para que "pronto sem pendência" bata com o que entra na planilha.

- `src/utils/tipoRecursoOficial.ts` (`getRecursosForaDaLista`) agora também é usado por `src/utils/distribuicaoTstPendencias.ts` → pendência `tipo_recurso_fora_lista_oficial` (causa típica: valores inventados pela Judit, ex. "AÇÃO TRABALHISTA - RITO ORDINÁRIO").
- Validação de dossiê extraída para `src/utils/dossieBenner.ts` (`getMotivoRejeicaoDossie`), compartilhada entre `CargaBennerFromDb.tsx` e as pendências → pendência `dossie_formato_invalido` (dossiê vazio continua coberto pelos campos obrigatórios).
- `Pendencia.alvoLabel` indica qual rótulo do formulário destacar quando o texto da pendência é explicativo/longo.
- Em `getMotivoBloqueioCarga` a pendência `dossie_formato_invalido` é filtrada do resumo genérico, para o arquivo de rejeições continuar mostrando o motivo dedicado do dossiê.
- Isenções continuam válidas: Acordo, CEJUSC, outro escritório, segredo de justiça, trânsito em julgado, recorrente somente Terceiro.
