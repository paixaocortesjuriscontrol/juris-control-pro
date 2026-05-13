## Diagnóstico

Hoje a coluna **AA (Recorrente)** da planilha Carga Benner é gravada com `dados_benner.recorrente`. Esse campo é populado automaticamente por Judit/IA com o nome livre do recorrente (ex.: "BANCO SANTANDER (BRASIL) S.A.") sempre que o registro é importado/atualizado, mesmo quando o advogado **não** seleciona nada na combo "Parte Recorrente" da aba **Distribuição TST**.

Confirmei no banco para o dossiê `07.02.033.0004058416/24`:

```
recorrente: "BANCO SANTANDER (BRASIL) S.A."
parte_recorrente_origem: NULL
```

A combo do form ("Parte Recorrente") tem apenas 4 opções fechadas: **Reclamante, Reclamada, Reclamante e Reclamada, Terceiro**. Hoje ela escreve no MESMO campo `recorrente` (ver `useDistribuicoesTst.ts` linhas 118 e 166: `parte_recorrente: b.recorrente` / `recorrente: d.parte_recorrente`), então o que veio da Judit "polui" a seleção do advogado e nunca há como saber se o usuário escolheu de fato.

## Mudanças

**1. Migration** (novo arquivo em `supabase/migrations/`)

```sql
ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS parte_recorrente text;
```

Coluna nova, dedicada **exclusivamente** à seleção do advogado. Não tocar em `recorrente` (mantém a string Judit/IA para outros usos).

**2. `src/hooks/useDistribuicoesTst.ts`**

- Linha 118 (load Benner → form): trocar `parte_recorrente: b.recorrente ?? null` por `parte_recorrente: b.parte_recorrente ?? null`.
- Linha 166 (save form → Benner): remover `recorrente: d.parte_recorrente` e gravar `parte_recorrente: d.parte_recorrente` em vez disso. Não sobrescrever `recorrente`.
- Adicionar `parte_recorrente: string | null` ao tipo de mapeamento, se necessário.

**3. `src/components/distribuicao-tst/CargaBennerFromDb.tsx` (linha 356)**

Trocar:
```ts
outRow[LAYOUT_COLS[26]] = String(d.recorrente ?? "").trim();
```
por:
```ts
outRow[LAYOUT_COLS[26]] = String((d as any).parte_recorrente ?? "").trim();
```
Sem fallback para `d.recorrente` ou qualquer outro campo. Vazio quando o advogado não selecionou.

**4. `src/utils/gerarPlanilhaBenner.ts` (linha 153)**

Trocar:
```ts
cleanDadoBennerValue(d.recorrente),
```
por:
```ts
cleanDadoBennerValue((d as any).parte_recorrente),
```

**5. Memória**

Atualizar/criar memória registrando que **coluna AA da Carga Benner = `dados_benner.parte_recorrente` (seleção da combo Distribuição TST), sem fallback**, e que `recorrente` é apenas o nome livre vindo de Judit/IA.

## Resultado esperado

- Dossiês cuja combo "Parte Recorrente" não foi selecionada saem com **AA em branco** (incluindo `07.02.033.0004058416/24`).
- Dossiês com seleção saem com exatamente o valor escolhido (Reclamante / Reclamada / Reclamante e Reclamada / Terceiro). "Banco" deixa de aparecer (não é opção da combo).
- Dados antigos: como `parte_recorrente` é coluna nova, todos os registros começam com NULL → coluna AA vazia até que o advogado revise. (Aceitável conforme pedido "exclusivamente da seleção, sem fallback".)
