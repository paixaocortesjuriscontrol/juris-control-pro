# Memory: features/monitoring/djen-pro-keyword-and-logic
Updated: 03/03/2026

## Busca por Palavra-chave na API

Monitoramentos do tipo 'palavra-chave' enviam termos **encurtados** (primeiras 2 palavras significativas) para a API PJE Comunica via `encurtarParaApi()`. Isso é necessário porque a API não retorna resultados para frases muito longas. A validação da frase COMPLETA é feita localmente após receber os resultados.

Exemplo: "GETNET ADQIRÊNCIA E SERVIÇOS PARA MEIOS DE PAGAMENTO S.A." → API recebe "GETNET ADQIRENCIA" → resultados filtrados localmente pela frase exata completa.

## Operador "+" (AND logic)

Termos com `+` (ex: 'SANTANDER + SEGUROS') implementam lógica AND. Cada segmento deve aparecer como frase exata no texto. A busca na API usa o segmento mais longo (encurtado) e a validação AND completa é feita localmente via `contemFraseComAnd`.

## termos_or (OR keywords)

Cada entrada em `termos_or` é buscada individualmente na API (também encurtada) e validada localmente como frase exata completa. Se QUALQUER termos_or corresponder, a publicação é aceita.
