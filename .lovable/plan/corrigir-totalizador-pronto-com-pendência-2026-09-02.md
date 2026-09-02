# Corrigir totalizador “Pronto com pendência”

## Objetivo
Fazer o card geral respeitar imediatamente o recorte aplicado ao clicar em “Prontos com pendências” de uma responsável, como a Kellen.

## Implementação
- Quando o filtro “com pendência” estiver ativo, usar diretamente o total de processos prontos já retornado pela consulta filtrada.
- Fora desse filtro, manter o cálculo atual: prontos menos prontos sem pendência.
- Preservar os demais filtros, cards e regras de pendência sem alterações.

## Validação
- Clicar no total “Prontos com pendências” de uma responsável e confirmar que o card geral mostra o mesmo total filtrado.
- Conferir o build e a lista resultante.
