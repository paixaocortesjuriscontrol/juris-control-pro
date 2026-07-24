# Nova lógica de trânsito em julgado — Botão Judit (form + lote)

Sem unificação. Aplico a mesma regra nova nos dois pontos que já existem, com uma detecção **centralizada na Edge Function** para não duplicar a regex.

## Regra (proposta pela advogada)

Considerar **trânsito em julgado** quando nas movimentações (`rd.steps[]`) da Judit existir:

1. Movimentação com **"Transitado em Julgado"** (texto ou código CNJ `848`); **ou**
2. Movimentação com **"Remetidos os Autos para Tribunal Regional do Trabalho"** (TST devolvendo autos após julgamento final).

**Reativação** (preserva memória `judit-multi-instance-fetch`): se depois do step de trânsito houver step de redistribuição, novo recurso ou inclusão em pauta, **não** marca trânsito.

**Data do trânsito** = `step_date` do movimento mais antigo que casou o padrão.

## Alterações

### 1. `supabase/functions/buscar-judit/index.ts` (centraliza a detecção)

- Nova função `detectarTransitoJulgado(rd)` que percorre `rd.steps[]` procurando:
  - `code === "848"`
  - `/tr[âa]nsito\s+em\s+julgado/i` em `title`/`content`/`description`
  - `/remetid[oa]s?\s+os\s+autos.*tribunal\s+regional\s+do\s+trabalho/i`
- Verifica reativação em steps posteriores; se houver, retorna `{ transitado: false }`.
- Aplica sobre a `rdSelecionada` **e** sobre a instância TRT (quando presente); trânsito se qualquer uma confirmar.
- Adiciona ao payload de resposta:
  - `transito_julgado_detectado: boolean | null`
  - `data_transito_julgado_detectada: string | null`
  - `motivo_transito: "movimento_848" | "texto_transito" | "remessa_trt" | null`

### 2. Botão Judit do formulário — `src/components/distribuicao-tst/DistribuicaoTstForm.tsx` (~linhas 1096-1105)

Substituir o bloco atual por:

```ts
if (data.transito_julgado_detectado === true) {
  next.transito_julgado = true;
  if (data.data_transito_julgado_detectada) {
    next.data_transito_julgado = data.data_transito_julgado_detectada;
  }
  filled.add("transito_julgado");
} else if (data.transito_julgado_detectado === false) {
  next.transito_julgado = false;
  next.data_transito_julgado = null;
  filled.delete("transito_julgado");
} else {
  // Fallback: lógica antiga por situacao/processo_baixado
  const juditAtivo = /ativ|active|em\s*curso|em\s*tramita|andamento/i.test(situacao) || baixado === "N";
  const ehTransito = !juditAtivo && (/arquivad|baixad|tr[âa]nsito/i.test(situacao) || baixado === "S");
  if (juditAtivo) { next.transito_julgado = false; next.data_transito_julgado = null; filled.delete("transito_julgado"); }
  else if (ehTransito && next.transito_julgado !== true) { next.transito_julgado = true; filled.add("transito_julgado"); }
}
```

Auto-save do form já cobre `transito_julgado` e `data_transito_julgado` (linha 510).

### 3. Botão Judit em lote — `src/lib/juditDistribuicaoTst.ts` > `buildJuditPatch` (~linhas 302-313)

Mesma precedência dentro de `buildJuditPatch`, para que `DossiesNaoLocalizadosButton` herde a regra automaticamente:

```ts
if (juditData?.transito_julgado_detectado === true) {
  patch.transito_julgado = true;
  if (juditData.data_transito_julgado_detectada) {
    patch.data_transito_julgado = juditData.data_transito_julgado_detectada;
  }
} else if (juditData?.transito_julgado_detectado === false) {
  patch.transito_julgado = false;
  patch.data_transito_julgado = null;
} else {
  // Fallback: lógica atual (situacao/baixado)
}
```

## Fora do escopo

- Unificação dos dois botões (fica pra depois).
- Backfill retroativo.
- Alterações em `consultar-processo-judit` / `check-transito`.
