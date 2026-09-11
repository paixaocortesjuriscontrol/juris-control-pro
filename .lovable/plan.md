# Atualização da Distribuição TST após salvar

## Objetivo
Ao salvar uma ficha, voltar para a lista mantendo todos os filtros ativos, mas usando imediatamente os dados atualizados.

## Alterações
- Remover a exceção que mantinha o processo salvo visível mesmo quando ele deixava de atender aos filtros.
- Atualizar a lista, os totalizadores gerais e os cards por responsável antes de fechar a ficha.
- Atualizar também os cards de pendências e matérias, que hoje possuem consultas independentes.
- Preservar página, filtros de busca, responsável e cards selecionados.

## Resultado esperado
Se o filtro “Pronto sem pendência” estiver ativo e o processo salvo passar a ter pendência, ele sairá da lista ao retornar; os números dos cards também refletirão a alteração.
