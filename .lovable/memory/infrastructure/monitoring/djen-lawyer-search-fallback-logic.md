# Memory: infrastructure/monitoring/djen-lawyer-search-fallback-logic
Updated: 09/02/2026

A busca por advogados no DJEN utiliza o parâmetro `nomeAdvogado` (não `palavraChave`) para consultas cross-UF. Correção aplicada em 3 pontos:

1. **BuscarDJEN.tsx** (`invokeBuscarDjenPreferBrowser`): passa `nomeAdvogado` do body para `buscarPjeComunicaNoBrowser`
2. **BuscarDJEN.tsx** (busca por monitoramento): quando tipo='advogado', inclui `nomeAdvogado: mon.termo_busca` nos searchItems
3. **useBuscaDjenDireta.ts** (`buscarMonitoramento`): passa `nomeAdvogado: variante.nome` ao invés de `palavraChave` para tipo advogado

O parâmetro `palavraChave` no `pjeComunicaClient.ts` gera `texto` na query, enquanto `nomeAdvogado` gera o parâmetro nativo `nomeAdvogado` da API PJE Comunica, que é essencial para buscas cross-UF (UF="TODAS").
