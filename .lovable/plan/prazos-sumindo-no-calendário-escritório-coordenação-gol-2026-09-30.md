# Prazos sumindo no calendário (Escritório + Coordenação GOL)

## O que está acontecendo
- Em setembro/2026 a GOL tem 991 prazos: 855 cumpridos, 130 pendentes (82 em 29/09 e 48 em 30/09), 3 protocolados e 3 baixados.
- Na tela, os dias 1 a 28 aparecem riscados porque estão cumpridos, como pedido na importação ("atrasados como cumpridos").
- Os pendentes de 29 e 30/09 não aparecem, e os contadores de prazos ficam em 0.
- Causa: no modo Escritório, o administrador busca 1.000 itens do mês de todas as coordenações, em ordem de data, e só depois separa os da GOL. O fim do mês fica de fora. A tela também não busca a próxima parte, porque depois dessa separação sobram menos de 1.000 itens.

## Correção
1. No modo Escritório com uma coordenação escolhida, buscar direto os itens daquela coordenação (tarefas, prazos, eventos e audiências).
2. Buscar a próxima parte sempre que alguma das buscas vier cheia (1.000 itens), mesmo depois de separar e juntar os itens.
3. Cumpridos continuam aparecendo com o V verde, sem risco, conforme a regra já combinada. O risco fica só em protocolado e baixado. Vou conferir isso no calendário, porque no print eles aparecem riscados.

## Conferência
- Conferir no banco se o Escritório + GOL em setembro traz os 991 itens, incluindo os 130 pendentes.
- Compilar sem erros.

## Detalhes técnicos
- `src/hooks/useAgendaUnificada.ts`: no ramo `fetchAll`, aplicar `.in("coordenacao_id", coordScopeIds)` quando houver escopo. `fetchAgendaPage` passa a registrar se alguma fonte retornou `halfPage` linhas. `getNextPageParam` usa essa marca, com `structuralSharing: false` para preservá-la, em vez de `lastPage.length === PAGE_SIZE`.
- `src/pages/PainelControle.tsx` (célula do calendário, cerca da linha 3412): tirar o `isConcluido` da condição de `line-through`.
