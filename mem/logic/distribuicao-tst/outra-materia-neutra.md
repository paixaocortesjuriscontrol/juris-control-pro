---
name: Outra Matéria não vai para a Carga Benner
description: "Outra Matéria" na Distribuição TST não gera pendência sozinha por sub-itens, é descartada na Carga Benner e, se for a única matéria, gera pendência
type: feature
---
Regra atual (2026-09-02):

- **Sub-itens**: "Outra Matéria" nunca cobra Aparelhamento / Chance Turma / Chance Relator / Êxito. Continua aparecendo como linha na tabela "Análise por Matéria" (preenchimento opcional).
- **Carga Benner**: "Outra Matéria" NUNCA é exportada. Conta como matéria fora da lista oficial: se nenhuma válida sobrou, o processo é rejeitado com "Matérias fora da lista oficial de pedidos".
- **Pendência**: se TODAS as matérias selecionadas (Reclamante/Reclamada/Terceiro) estiverem fora da lista oficial — inclusive o caso de "Outra Matéria" sozinha ou só com outras inválidas — o processo gera a pendência "Matérias fora da lista oficial de pedidos".

A lista oficial (`materias_pedidos_oficiais`) é carregada em cache por `src/utils/materiasOficiaisCache.ts` antes do cálculo de pendências; `isMateriaOficialSync` sempre retorna false para "Outra Matéria".
