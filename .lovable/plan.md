# Consumo Judit: parar o travamento ao trocar as datas

## O que acontece hoje
- Cada número digitado em "De" ou "Até" dispara uma busca nova. Enquanto o ano é digitado, a data passa por valores como 0002-11-01, e o sistema busca de uma vez até 10.000 consultas, com o conteúdo completo de cada uma.
- Se a busca dá erro, o aviso vermelho é disparado a cada redesenho da tela, o que pode travá-la de vez.

## O que muda
1. As datas só são aplicadas quando estiverem completas e válidas (ano com 4 dígitos, "De" menor ou igual a "Até") e depois de uma pausa curta na digitação. Enquanto isso, a tela mostra os dados anteriores, sem ficar em branco.
2. O aviso de erro aparece uma única vez por falha.
3. A busca deixa de trazer o conteúdo completo de cada consulta; vem só o necessário para saber o tipo de cobrança. Os números exibidos não mudam.
4. O período passa a seguir o horário de Brasília (hoje ele usa UTC).

## Como conferir
- Abrir Consumo Judit, digitar datas novas em De/Até e ver que a tela não trava e que os totais são os mesmos de antes para o mesmo período.

## Detalhes técnicos
- `src/pages/ConsumoJudit.tsx`: estado de rascunho para as datas, com debounce de 500 ms e validação antes de entrar no `queryKey`; `placeholderData: keepPreviousData`; o toast de erro sai do corpo do componente e vai para um `useEffect` com `[error]`.
- Na seleção, trocar `request_payload` inteiro por campos JSON (`request_payload->com_anexos`, `with_attachments`, `on_demand`, `force_refresh` e o que `detectarTipo` lê), mantendo a mesma classificação.
- Limites em BRT: `${from}T00:00:00-03:00` até `${to}T23:59:59.999-03:00`.
- Se a tabela não tiver índice em `created_at`, isso fica registrado como próximo passo (consulta ao banco indisponível neste momento).
