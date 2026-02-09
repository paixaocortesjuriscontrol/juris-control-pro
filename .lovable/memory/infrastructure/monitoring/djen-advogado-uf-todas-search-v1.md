# Memory: infrastructure/monitoring/djen-advogado-uf-todas-search-v1
Updated: 09/02/2026

Quando o monitoramento de advogado está configurado com UF="TODAS", a API PJE Comunica IGNORA o parâmetro `numeroOab` sem `ufOab`. A solução implementada em `pjeComunicaClient.ts` e `buscar-djen/index.ts` é:

1. Se UF é específica (ex: "DF"): busca por `numeroOab` + `ufOab` (mais precisa)
2. Se UF é "TODAS" ou ausente: busca por `nomeAdvogado` (cross-UF)
3. A validação de conteúdo (OAB no texto) ainda garante precisão dos resultados

Isso afeta tanto a busca direta no navegador quanto o proxy Edge Function.
