---
name: Outra Matéria neutra
description: "Outra Matéria" na Distribuição TST não gera pendência/aviso, não rejeita e é exportada na Carga Benner
type: feature
---
Regra atual (2026-09): a opção "Outra Matéria" nas matérias dos recursos da Distribuição TST é **totalmente neutra**:

- Nunca gera pendência nem aviso amarelo (tela de consulta, "Verificar Pendências", relatório, kanban).
- Nunca rejeita o processo na Carga Benner (não conta como "matéria fora da lista oficial de pedidos").
- É exportada literalmente ("Outra Matéria") nas colunas de matérias da planilha de carga.
- Continua aparecendo como linha na tabela "Análise por Matéria" (preenchimento opcional).
- Nenhum alerta na lista da Distribuição TST sobre processos com "Outra Matéria".

Matérias que não sejam "Outra Matéria" e estejam fora de `materias_pedidos_oficiais` continuam sendo descartadas/rejeitadas.
