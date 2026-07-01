## Problema

Na tela **Análise DJEN**, com "Somente Hoje" ativo e campo "Data Disponibilização" vazio:

1. Publicações Kurier de hoje (30/06) com `data_publicacao = 01/07` não aparecem.
2. Publicações Kurier que chegam atrasadas hoje (30/06) mas têm `data_disponibilizacao = 29/06` também não aparecem — e o usuário precisa vê-las, porque foram capturadas hoje.

## Causa raiz

Em `src/hooks/usePublicacoesDjenUnificadas.ts` (e gêmeo `usePublicacoesDjenServidorUnificadas.ts`), a função `aplicarFiltroDataPublicacaoHojeBrt` filtra "hoje" por `data_publicacao`/`data_disponibilizacao` na janela do dia BRT. Isso ignora a natureza do Kurier, onde o que importa é o **dia da captura** (`created_at`), já que o Kurier entrega publicações com atraso (disp de dias anteriores) e às vezes adiantadas (pub do dia seguinte).

## Correção

Tornar o filtro "Somente Hoje" **sensível à fonte**:

- **Fonte `kurier`** → matchear pelo dia da captura: `created_at` dentro do dia BRT de hoje (janela UTC já calculada). Isso garante que tudo capturado hoje aparece, seja com `data_disponibilizacao = 30/06`, `29/06` (atrasado) ou `data_publicacao = 01/07` (adiantado).
- **Demais fontes (DJEN/DJET/etc.)** → manter comportamento atual: casa por `data_publicacao` OU `data_disponibilizacao` no dia BRT, com fallback `created_at` quando ambos forem NULL. Remover a restrição supérflua `data_publicacao.is.null` das cláusulas de `data_disponibilizacao` para também resolver o caso "DJEN com pub no dia seguinte e disp hoje".

Estrutura final do `or(...)` quando `apenasHoje=true`:

```
or(
  fonte.eq.kurier,created_at.gte.<inicioDiaUtc>,created_at.lte.<fimDiaUtc>  → combinadas via and(...)
  and(fonte.neq.kurier, data_publicacao gte/lte janela UTC),
  and(fonte.neq.kurier, data_publicacao gte/lte dia BRT UTC),
  and(fonte.neq.kurier, data_disponibilizacao gte/lte janela UTC),
  and(fonte.neq.kurier, data_disponibilizacao gte/lte dia BRT UTC),
  and(fonte.neq.kurier, data_publicacao.is.null, data_disponibilizacao.is.null, created_at gte/lte janela UTC)
)
```

(Sintaxe PostgREST real: cada ramo dentro de um `and(...)` no `.or(...)`. A condição `fonte.neq.kurier` exclui Kurier dos ramos por data; o ramo Kurier usa apenas `created_at`.)

## Campo "Data Disponibilização" manual

Quando o usuário **digita** uma data no campo "Data Disponibilização", o comportamento continua igual (filtra por `data_disponibilizacao` exato no banco, sem cláusula Kurier especial). É só o atalho "Somente Hoje" que ganha o tratamento por `created_at` para Kurier.

## Escopo

Apenas dois arquivos, apenas a função `aplicarFiltroDataPublicacaoHojeBrt`:

- `src/hooks/usePublicacoesDjenUnificadas.ts`
- `src/hooks/usePublicacoesDjenServidorUnificadas.ts`

Sem mudanças em UI, contadores de cards, exportações ou outros filtros.

## Resultado esperado

Em 30/06/2026, com "Somente Hoje" e "Data Disponibilização" vazio:

- Aparecem todas as 522 publicações Kurier capturadas hoje, incluindo as com `Disp: 29/06` e `Pub: 30/06` mostradas no print.
- Publicações DJEN do dia com `data_publicacao = 01/07` e `data_disponibilizacao = 30/06` também aparecem.
- Publicações antigas (capturadas em dias anteriores) continuam fora.