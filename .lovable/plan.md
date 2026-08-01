# Corrigir “Sem pendências” divergente na Distribuição TST

## Diagnóstico confirmado

- O processo `0020529-89.2022.5.04.0371` está com `status = pronto_envio`, recorrente `Reclamante e Reclamada` e possui campos vazios em `materias_analise_reclamante` e `materias_analise_banco`.
- O formulário mostra corretamente essas lacunas: Aparelhamento e Êxito estão nulos nas matérias.
- A classificação incorreta vem da regra anterior, que considerava `recurso_terceiros = SIM` uma isenção do formulário inteiro e retornava “Sem pendências” antes de validar as matérias.
- A correção dessa isenção já está no código atual, mas a versão pública consultada ainda é o build `4.3.3` de 31/07/2026, anterior à correção.

## Implementação

1. Manter `getPendencias` como única fonte de verdade para lista, card “Pronto sem pendência”, relatório e geração da Carga Benner.
2. Garantir que `Recurso de Terceiros = SIM` seja somente um campo informativo e nunca isente recursos do Reclamante ou Banco; a exceção continuará válida apenas quando `Terceiro` for a única parte recorrente.
3. Validar as matérias reconciliadas com a seleção do formulário, cobrando Aparelhamento, Chance Turma, Chance Relator e Êxito mesmo quando o JSONB ainda não possui uma linha persistida para alguma matéria selecionada.
4. Atualizar imediatamente a lista e o totalizador após salvar/fechar o formulário, evitando selo antigo em cache.
5. Adicionar testes de regressão para o caso apresentado e para as exceções legítimas.

## Resultado esperado

- Esse processo deixará de aparecer como “Sem pendências” e exibirá todas as lacunas reais.
- Ele será excluído do card “Pronto sem pendência” e bloqueado na Carga Benner até o preenchimento completo.
- Lista, formulário, relatório e geração da carga passarão a usar exatamente o mesmo critério.