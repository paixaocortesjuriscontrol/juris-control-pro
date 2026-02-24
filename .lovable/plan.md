

# Correção: DJEN Termos Pro não encontra publicações do TST para advogado com OAB/DF

## Problema Real

O monitoramento está configurado com:
- Tipo: advogado
- OAB: 15553, UF: DF
- Tribunais: apenas **TST**

O `tribLoop` está correto (TST tem length 1, entra no loop). O problema está na **construção da query da API PJE Comunica**:

Quando a busca envia `numeroOab=15553 + ufOab=DF + siglaTribunal=TST`, a API PJE Comunica aparentemente filtra de forma restritiva: busca advogados registrados com OAB/DF **apenas em tribunais da jurisdição DF**. Como o TST é um tribunal superior federal, a API não retorna resultados para essa combinação.

Os fallbacks (nomeAdvogado + OAB, texto) também falham porque mantêm `ufOab=DF` na query, e a API continua filtrando pela jurisdição.

A busca complementar por texto (palavra-chave com o nome do advogado) busca SEM `siglaTribunal`, então os resultados podem vir de qualquer tribunal, mas se a API também não retorna TST para texto genérico, o resultado é vazio.

## Solução

Alterar a lógica de busca no `useDjenTermosProEngine.ts` para que, quando o tribunal configurado for diferente da UF do advogado (ou for um tribunal superior como TST/STJ/STF), a busca seja feita de duas formas:

1. Busca padrão (com `ufOab`) -- mantém o comportamento atual
2. Busca adicional **sem `ufOab`**, usando apenas `nomeAdvogado` + `siglaTribunal` -- para capturar publicações em tribunais federais/superiores

Além disso, a busca complementar por texto (palavra-chave) passará a incluir `siglaTribunal` para cada tribunal configurado, evitando buscas genéricas que retornam muitos resultados irrelevantes.

## Alterações Técnicas

### Arquivo: `src/hooks/useDjenTermosProEngine.ts`

**1. Adicionar busca sem `ufOab` para tribunais superiores/federais (após o loop principal, linhas ~498-513)**

Após o loop principal de tribunais, se nenhum resultado foi encontrado e o tribunal é "superior" (TST, STJ, STF, TRFs) ou diferente da UF do advogado, fazer uma segunda busca usando apenas `nomeAdvogado` + `siglaTribunal` (sem `ufOab`/`numeroOab`):

```typescript
// Se busca por OAB retornou vazio e temos tribunais superiores, tentar por nomeAdvogado
if (isAdvogadoComOab && resultados.length === 0 && !signal.aborted) {
  const tribunaisSuperiores = tribunais.filter(t => 
    /^(TST|STJ|STF|TRF\d+)$/i.test(t)
  );
  
  if (tribunaisSuperiores.length > 0 || tribunais.length > 0) {
    const tribsRetry = tribunaisSuperiores.length > 0 ? tribunaisSuperiores : tribunais;
    for (const trib of tribsRetry) {
      if (signal.aborted) break;
      try {
        const resp = await buscarPjeComunicaPaginado(
          { 
            tipo: 'advogado',
            nomeAdvogado: mon.termo_busca,
            // SEM ufOab e SEM numeroOab -- busca apenas por nome
            siglaTribunal: trib, 
            dataInicio: diaYmd, dataFim: diaYmd, 
            pageSize: 50, page: 0 
          },
          { signal, maxPages: 20, ... }
        );
        addResults(resp.items, trib);
      } catch (e: any) {
        if (e?.name === 'AbortError') break;
        console.warn(`[DJEN Pro] Retry sem ufOab ${trib}:`, e?.message);
      }
      await delay(1200);
    }
  }
}
```

**2. Adicionar `siglaTribunal` na busca complementar por texto (linhas ~524-537)**

A busca por palavra-chave (texto) com o nome do advogado atualmente busca sem tribunal. Alterar para iterar pelos tribunais configurados:

```typescript
for (const termo of nomesTexto) {
  if (signal.aborted) break;
  const textTribLoop = tribunais.length > 0 ? tribunais : [undefined as string | undefined];
  for (const trib of textTribLoop) {
    if (signal.aborted) break;
    try {
      const resp = await buscarPjeComunicaPaginado(
        { tipo: 'palavra-chave', palavraChave: termo, 
          siglaTribunal: trib,
          dataInicio: diaYmd, dataFim: diaYmd, pageSize: 50, page: 0 },
        { signal, maxPages: 5, ... }
      );
      addResults(resp.items, trib);
    } catch (e: any) { ... }
    await delay(600);
  }
}
```

**3. Generalizar o filtro de tribunal na validação (linha 552)**

Atualmente o filtro de tribunal só se aplica quando `isAdvogadoComOab`. Alterar para aplicar sempre que houver tribunais configurados:

```typescript
// Antes:
if (isAdvogadoComOab && tribunais.length > 0) {

// Depois:
if (tribunais.length > 0) {
```

Isso garante que qualquer tipo de monitoramento com tribunais configurados filtre resultados corretamente.

## Resumo das Mudanças

| Alteração | Onde | Motivo |
|---|---|---|
| Busca retry sem `ufOab` para tribunais superiores | Após tribLoop (linhas 498-513) | API PJE Comunica ignora OAB/DF quando tribunal é TST |
| `siglaTribunal` na busca por texto | Linhas 524-537 | Focalizar busca complementar no tribunal correto |
| Filtro tribunal generalizado | Linha 552 | Aplicar filtro de tribunal para todos os tipos, não só advogado com OAB |

Apenas o arquivo `src/hooks/useDjenTermosProEngine.ts` será alterado.
