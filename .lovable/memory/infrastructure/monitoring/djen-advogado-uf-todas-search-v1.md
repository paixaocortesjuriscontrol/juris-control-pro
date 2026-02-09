# Memory: infrastructure/monitoring/djen-advogado-uf-todas-search-v1
Updated: 09/02/2026

Quando o monitoramento de advogado está configurado com UF="TODAS", a API PJE Comunica IGNORA tanto o parâmetro `numeroOab` (sem `ufOab`) quanto o parâmetro `nomeAdvogado` como filtro de busca. A solução implementada em `pjeComunicaClient.ts`, `buscar-djen/index.ts` e `fetch-djen.ts` é:

1. Se UF é específica (ex: "DF"): busca por `numeroOab` + `ufOab` (mais precisa)
2. Se UF é "TODAS" ou ausente: busca por `texto` com o nome do advogado (full-text search no conteúdo)
   - O parâmetro `nomeAdvogado` é enviado como redundância mas NÃO funciona sozinho
   - O parâmetro `texto` faz full-text search e É o que retorna resultados
3. A validação de conteúdo (OAB no texto) ainda garante precisão dos resultados

IMPORTANTE: O parâmetro `nomeAdvogado` da API PJE Comunica NÃO funciona como filtro de busca no endpoint `/comunicacao`. Apenas `texto` faz full-text search efetivo.
