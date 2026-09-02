# Corrigir aviso "(fora lista do Benner)" falso após importar pedidos

## O que está acontecendo

As matérias marcadas em verde da imagem (Custas processuais, Despesas processuais, Honorários de Sucumbência Reclamada) **já estão cadastradas e ativas** na lista oficial — verificado no banco.

O aviso aparece porque a lista oficial é guardada em um cache na memória do navegador, carregado uma única vez ao abrir a tela. A importação "Pedidos por dossiê" cadastra os pedidos novos no banco, mas esse cache continua com a lista antiga até o usuário recarregar a página. Resultado: pedido verde (está no dossiê) e, ao mesmo tempo, com o aviso de fora da lista.

## Correção

1. `src/utils/materiasOficiaisCache.ts`: adicionar `resetMateriasOficiais()`, que limpa o cache (e a promessa em voo) para que a próxima consulta recarregue do banco.
2. `src/components/distribuicao-tst/PedidosPorDossieDialog.tsx`: ao final da importação, chamar `resetMateriasOficiais()` e em seguida `ensureMateriasOficiais()` (já com o `invalidateQueries` existente), garantindo que a lista recarregue antes de fechar o diálogo.
3. `src/components/distribuicao-tst/MateriasMultiSelect.tsx`: em vez de guardar `oficiaisProntas` apenas uma vez, reagir à recarga — checar `materiasOficiaisCarregadas()` quando o popover abre e após o `ensure`, para que a marcação reflita a lista atual sem recarregar a página.

## Observações

- Nenhuma mudança de banco, de validação de pendências ou da geração da Carga Benner.
- Enquanto o cache estiver vazio, o comportamento atual permanece: nada é marcado como fora da lista (sem falso positivo).
