# Memory: infrastructure/monitoring/djen-advogado-uf-todas-search-v1
Updated: 09/02/2026

Quando o monitoramento de advogado está configurado com UF="TODAS", a API PJE Comunica IGNORA o parâmetro `numeroOab` sem `ufOab`. A solução implementada em `pjeComunicaClient.ts`, `buscar-djen/index.ts` e `fetch-djen.ts` é:

1. Se UF é específica (ex: "DF"): busca por `numeroOab` + `ufOab` (mais precisa)
2. Se UF é "TODAS" ou ausente: busca por `nomeAdvogado` (cross-UF)
   - Conforme URL oficial do site: comunica.pje.jus.br/consulta?nomeAdvogado=...
   - O parâmetro `nomeAdvogado` é o correto para buscas cross-UF
3. A validação de conteúdo (OAB no texto) ainda garante precisão dos resultados

IMPORTANTE: NÃO usar `texto` junto com `nomeAdvogado` - os parâmetros podem conflitar. Usar apenas `nomeAdvogado` para advogados cross-UF.
