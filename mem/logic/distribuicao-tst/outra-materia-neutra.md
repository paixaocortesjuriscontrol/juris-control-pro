---
name: Outra Matéria não vai para a Carga Benner
description: "Outra Matéria" na Distribuição TST não gera pendência/aviso, mas é descartada e pode rejeitar o processo na Carga Benner
type: feature
---
Regra atual (2026-09-01, atualizada):

- **Pendências**: "Outra Matéria" continua neutra — nunca gera pendência nem aviso amarelo (tela de consulta, "Verificar Pendências", relatório, kanban). Continua aparecendo como linha na tabela "Análise por Matéria" (preenchimento opcional).
- **Carga Benner**: "Outra Matéria" NUNCA é exportada. É contada como matéria fora da lista oficial: se o processo tinha matérias selecionadas e nenhuma válida sobrou, é rejeitado com o motivo "Matérias fora da lista oficial de pedidos"; se sobrou alguma válida, exporta só as válidas e gera aviso de descarte.

Matérias fora de `materias_pedidos_oficiais` continuam sendo descartadas/rejeitadas.

Regra adicional (2026-09-02): se TODAS as matérias selecionadas (Reclamante/Reclamada/Terceiro) estiverem fora da lista oficial (incluindo "Outra Matéria" sozinha), o processo gera PENDÊNCIA ("Matérias fora da lista oficial de pedidos") e é rejeitado na Carga Benner. A lista oficial é carregada em cache por `src/utils/materiasOficiaisCache.ts` antes do cálculo de pendências.
