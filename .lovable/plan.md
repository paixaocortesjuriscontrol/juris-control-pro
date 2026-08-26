# Bloquear matérias fora da lista oficial na Carga Benner

## Objetivo
Na geração da Carga Benner (Distribuição TST → "Gerar Carga Benner"), nenhuma matéria fora da lista oficial de pedidos do Santander pode ser exportada. Se todas as matérias de um processo estiverem fora da lista, o processo é rejeitado e o usuário é avisado.

## Regras
1. Antes de gerar, carrega a lista oficial (`materias_pedidos_oficiais`, apenas ativas) e monta um conjunto normalizado (sem acentos, minúsculas, espaços colapsados).
2. Ao montar as colunas de matérias (Favorável/Desfavorável turma e relator, Bem/Mal aparelhado, Com chances de êxito), além de "Outra Matéria" também são descartadas as matérias que não constam na lista oficial — para Reclamante, Banco (Reclamada) e Terceiro.
3. Rejeição: se o processo tinha ao menos uma matéria selecionada e, após o filtro, sobrou nenhuma matéria válida em nenhuma parte, a linha vai para a aba de Rejeições com o motivo:
   `Matérias fora da lista oficial de pedidos`
   (mesmo em modo de seleção manual, seguindo o padrão dos bloqueios impeditivos).
4. Se o processo tem matérias válidas e também inválidas, ele é exportado apenas com as válidas e conta como aviso ("Matérias descartadas fora da lista oficial: N"), exibido no resumo pós-geração.
5. Processos sem nenhuma matéria selecionada continuam com o comportamento atual (não são rejeitados por esta regra).
6. Aviso ao usuário: toast/resumo ao final informando quantos processos foram rejeitados por matérias fora da lista, com a contagem aparecendo em "Rejeições por tipo".

## Detalhes técnicos
- `src/components/distribuicao-tst/CargaBennerFromDb.tsx`:
  - carregar as matérias oficiais no início de `handleGenerate` (consulta paginada a `materias_pedidos_oficiais` com `ativo = true`) e construir `Set<string>` normalizado com `normalizeMateriaNome` de `src/utils/outraMateria.ts`;
  - estender `filtrarOutraMateria` → `filtrarMateriasExportaveis` (descarta "Outra Matéria" + fora da lista, retornando também as descartadas para estatística);
  - calcular por registro `totalSelecionadas` e `totalValidas`; quando `totalSelecionadas > 0 && totalValidas === 0`, empurrar em `rejected` e marcar `isRejected = true` (a linha continua indo para a Planilha de Conferência, como já ocorre hoje);
  - somar avisos em `warningsByType` para o caso parcial.
- Nenhuma mudança de schema. A lista oficial já existe na tabela `materias_pedidos_oficiais`.
- Escopo: apenas a geração via banco (`CargaBennerFromDb`), que é a usada na tela Distribuição TST.
