---
name: DJEN Servidor pagination parity
description: monitor-servidor/engines/paralela.js must mirror browser continueUntilEmpty pagination
type: constraint
---
O motor `monitor-servidor/engines/paralela.js` precisa replicar:

1. **Paginação `continueUntilEmpty`**: A API PJE Comunica retorna páginas curtas ou `hasMore=false` no meio do stream em buscas amplas. `buscarPaginado` só encerra quando duas páginas consecutivas vierem vazias, quando `added===0` (todos duplicados via id_djen), ou quando `total` declarado for alcançado.

2. **Validação `contemTermo` no texto COMPLETO** (não só no `conteudo`): precisa concatenar `conteudo + destinatarioadvogados[].advogado.nome + destinatarios[].nome + poloAtivo/Passivo + partes[]`. Sem isso, publicações em que o advogado/parte só aparece nos metadados estruturados são descartadas. Espelha `validarTermo` + `buildTextoCompleto` em `src/hooks/useDjenTermosParalelaEngine.ts`.

3. **Tipo `advogado`**: validar OAB (>=3 dígitos) e nome no texto completo, e iterar `termos_or` com `parsearTermoOr` (formatos `12345/NOME`, `NOME/12345`, `TJSP - Adv. NOME`).

4. **Suplemento advogado por OAB descoberta**: quando o monitoramento de advogado não tem OAB configurada e a busca por `nomeAdvogado` retorna metadados com `numero_oab`/`uf_oab` do próprio advogado, o Servidor deve fazer uma segunda busca oficial por `numeroOab + ufOab + nomeAdvogado` e mesclar por `id_djen`. Isso corrige casos como TRT8/OSMAR em que a rota por nome não traz as páginas finais, sem consultar `publicacoes_djen`.

Bug histórico: `contemTermo` só verificava `conteudo` cru, causando descartes massivos (ex.: 421 descartadas / 0 novas na Santander Cível em 2026-06-15, enquanto o browser persistia 239).

Memórias relacionadas do browser: `mem/features/monitoring/djen-paralela-pagination-fix.md`, `mem/features/monitoring/djen-pagination-continueuntilempty.md`.