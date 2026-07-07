## Plano — Dedup Kurier equivalente ao DJEN

**Causa raiz (confirmada no banco):**
- Coord `143e5ebb` / monitoramento `__CAPTURA_TOTAL_KURIER__`: 62 registros = 31 `id_kurier` distintos × 2 inserts cada.
- O código do Kurier (`supabase/functions/kurier-consultar-publicacoes/index.ts`) grava `id_kurier` só em `kurier_publicacoes_raw`, e em `publicacoes_djen` usa `hash_conteudo` **propositalmente randomizado** com `Date.now()|Math.random()` (linhas 1004 e 1074) — o que desabilita qualquer dedup nativa no insert.
- O DJEN usa unique parcial em `(coordenacao_id, monitoramento_id, id_djen)`. O Kurier não tem esse índice equivalente com `id_kurier`.

**Fix (espelhar a regra do DJEN):**

1. **Migration**
   - Adicionar coluna `id_kurier text` em `publicacoes_djen`.
   - Criar índice único parcial:
     ```
     CREATE UNIQUE INDEX publicacoes_djen_kurier_dedup_idx
       ON public.publicacoes_djen (coordenacao_id, monitoramento_id, id_kurier)
       WHERE id_kurier IS NOT NULL;
     ```
   - **Limpeza prévia (obrigatória antes de criar o índice):** apagar duplicatas mantendo a linha mais antiga por `(coordenacao_id, monitoramento_id, id_kurier)`, usando o `id_kurier` que já está em `kurier_publicacoes_raw` para preencher a nova coluna nas linhas existentes.

2. **Edge function `kurier-consultar-publicacoes`**
   - Preencher `id_kurier: idKEff` no `basePayload`.
   - Remover o randomizador do `hash_conteudo` (usar o `hashConteudo` determinístico já calculado a partir de `numero|dataDisp|conteudo`).
   - Trocar os dois `.insert(...)` (match e captura_total) por `.upsert(..., { onConflict: 'coordenacao_id,monitoramento_id,id_kurier', ignoreDuplicates: true })`. Tratar retorno vazio como duplicata (não incrementa `totalNovas`).
   - Continuar gravando o raw em `kurier_publicacoes_raw` como hoje.

3. **Efeito esperado**
   - Mesmo item Kurier reprocessado N vezes (fila devolvendo repetido, retries, dois paths match+captura_total) grava **1 linha só** por (coordenação, monitoramento, id_kurier).
   - Comportamento idêntico ao DJEN, que já faz isso via `id_djen`.
   - Publicações genuinamente diferentes (id_kurier distintos, um por destinatário) continuam existindo — não há perda de informação.

**Arquivos afetados**
- Nova migration (coluna + limpeza + índice único parcial).
- `supabase/functions/kurier-consultar-publicacoes/index.ts` (preencher `id_kurier`, remover randomização de hash, trocar insert por upsert nos dois pontos).

**Nenhum outro motor afetado** — DJEN Termos Servidor, Browser e Kurier todos passam a ter uma dedup baseada no id nativo da fonte.