---
name: Outra Matéria é oficial e sai em branco na Carga Benner
description: "Outra Matéria" consta na lista oficial (materias_pedidos_oficiais), não gera pendência nem rejeição, e é exportada com o nome em branco na Carga Benner
type: feature
---
Regra atual (2026-09-02):

- **Banco**: "Outra Matéria" está cadastrada e ativa em `materias_pedidos_oficiais`. `isMateriaOficialSync` não tem mais exceção para ela.
- **Sub-itens**: "Outra Matéria" nunca cobra Aparelhamento / Chance Turma / Chance Relator / Êxito. Continua como linha na tabela "Análise por Matéria" (preenchimento opcional).
- **Pendência**: processo com "Outra Matéria" selecionada nunca gera a pendência "Matérias fora da lista oficial de pedidos", mesmo que todas as demais matérias estejam fora da lista.
- **Carga Benner**: o processo é exportado; a matéria "Outra Matéria" vai com o **nome em branco** na planilha (nunca aparece o texto). Demais matérias fora da lista continuam descartadas e, se não sobrar nenhuma válida, o processo é rejeitado com "Matérias fora da lista oficial de pedidos".
