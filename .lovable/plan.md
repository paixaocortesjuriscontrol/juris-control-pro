## Plano corrigido

Você está certo: **termo do tipo `parte` não pode buscar por palavra-chave**. Não vou reintroduzir fallback. O único motor a mexer será o **DJEN Termos Paralelo**.

## O que será alterado

1. **Travar a regra de busca por parte no motor paralelo**
   - Em `useDjenTermosParalelaEngine.ts`, manter `tipo: 'parte'` usando exclusivamente `nomeParte`.
   - Garantir que `palavraChave` nunca seja enviada quando `mon.tipo === 'parte'`.
   - Remover/evitar qualquer retry ou fallback que transforme parte em palavra-chave.

2. **Corrigir o problema real mostrado nos logs: 429**
   - A execução paralela está tomando `HTTP 429 Too Many Attempts` no PJE Comunica.
   - Reduzir o paralelismo por host PJE Comunica de `2` para `1`, porque todos os tribunais usam o mesmo backend.
   - Aumentar o espaçamento/retry para não “queimar” a sequência de termos após o primeiro bloqueio.

3. **Manter paginação completa para parte**
   - Preservar `continueUntilEmpty: true` e `maxPages: null` no `buscarPjeComunicaPaginado`.
   - A busca deve seguir página por página até página vazia, sem parar por `hasMore=false` quando a API mentir.

4. **Garantir que resultado encontrado via `nomeParte` seja aceito**
   - Publicações retornadas pela API via `nomeParte` continuarão marcadas com `__matchedByNomeParte`.
   - Isso evita descarte indevido quando o TST não devolve metadados estruturados completos.

5. **Blindagem contra regressão**
   - Adicionar uma proteção explícita no código: se `tipo === 'parte'`, lançar/registrar alerta interno caso `palavraChave` apareça nos parâmetros.
   - Assim o bug antigo não volta silenciosamente.

## Arquivo previsto

- `src/hooks/useDjenTermosParalelaEngine.ts`

## Não será feito

- Não mexer nos engines Flash ou Pro.
- Não usar busca por palavra-chave para termo do tipo parte.
- Não criar fallback de parte para texto/palavra-chave.