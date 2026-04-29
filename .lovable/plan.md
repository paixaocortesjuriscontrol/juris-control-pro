
## Por que precisa baixar PDF

A API PJe Comunica (usada pela DJEN Termos Paralela) só expõe **intimações com efeito intimatório**. Pautas de julgamento da Justiça do Trabalho **não são intimações** — são publicações do caderno Judiciário do DEJT, distribuídas só em PDF. O Kurier faz exatamente isso: baixa o PDF do dia, do tribunal, e procura termos lá dentro. Não há atalho via API.

A boa notícia: já existe a edge function `baixar-dje-pdf` com o mapeamento de URLs DEJT (TST + TRTs 1, 2, 10, 23, 24). Vamos extrair esse mapa para `_shared` e completar com os 24 TRTs.

## Princípio: separação total

Nenhum arquivo da **DJEN Termos Paralela** será modificado. Tudo é cópia paralela:

| DJEN Termos Paralela (existente) | DJET Pautas Paralela (nova) |
|---|---|
| `useDjenTermosParalelaEngine.ts` | `useDjetPautasParalelaEngine.ts` |
| `useDjenTermosParalela.ts` | `useDjetPautasParalela.ts` |
| `useDjenTermosParalelaScheduler.ts` | `useDjetPautasParalelaScheduler.ts` |
| `MonitoramentoTermosParalelaCard.tsx` | `MonitoramentoDjetPautasCard.tsx` |
| Edge: PJe Comunica (existente) | Edge nova: `buscar-dejt-pautas` |
| `publicacoes_djen` (tipo intimação) | `publicacoes_djen` com `tipo_publicacao='pauta'` |

## Arquitetura

```text
┌────────────────────────────────────────────────────────┐
│ Card: DJET Pautas Paralela                            │
│ - Iniciar / Cancelar / Reset / Agendador              │
│ - 25 tracks (TST + TRT1..TRT24), 5 em paralelo        │
└──────────────┬─────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────┐
│ useDjetPautasParalelaEngine (browser, singleton)      │
│ - loop: tribunal → dia                                 │
│ - checkpoint em localStorage (chave própria)          │
│ - dedup local + dedup por hash no banco               │
└──────────────┬─────────────────────────────────────────┘
               │ uma chamada por (tribunal, dia)
               ▼
┌────────────────────────────────────────────────────────┐
│ Edge: buscar-dejt-pautas                               │
│ 1. baixa PDF do caderno Judiciário (DEJT)              │
│ 2. extrai texto com unpdf                              │
│ 3. segmenta por marcadores de pauta                    │
│ 4. casa termos/OAB/exclusões dos monitoramentos        │
│ 5. devolve matches                                     │
└──────────────┬─────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────┐
│ publicacoes_djen (tipo_publicacao='pauta')             │
│ - reaproveita análise/notificações já existentes       │
└────────────────────────────────────────────────────────┘
```

## Passos

### 1. Migration
- Adicionar `tipo_publicacao text not null default 'intimacao'` em `publicacoes_djen` (`'intimacao'` | `'pauta'`).
- Criar índice `(monitoramento_id, tipo_publicacao, data_publicacao desc)`.
- Linhas existentes ficam automaticamente como `'intimacao'`. Nada quebra.

### 2. Refator leve (não afeta DJEN)
- Extrair o `TRIBUNAIS` map de `supabase/functions/baixar-dje-pdf/index.ts` para `supabase/functions/_shared/dejtTribunais.ts` e completar TRTs 3..22.
- `baixar-dje-pdf` passa a importar do `_shared` (mudança de import só, comportamento igual).

### 3. Edge nova: `buscar-dejt-pautas`
- `verify_jwt = true`. Sem novos secrets.
- Input: `{ tribunal, dataDDMMYYYY, monitoramentos: [{id, termos, oab, exclusoes, ...}] }`.
- Baixa PDF (`fetch`); se `content-type !== application/pdf` (manutenção/feriado), retorna `{ ok:true, sem_dados:true, motivo:'no-pdf' }` (200, mesmo padrão do `orquestrador-transito`).
- Extrai texto com **unpdf** (Deno-friendly, sem deps nativas).
- Segmenta por marcadores: `PAUTA DE JULGAMENTO`, `SESSÃO ORDINÁRIA`, `SESSÃO EXTRAORDINÁRIA`, `SESSÃO TELEPRESENCIAL`.
- Para cada bloco: extrai número CNJ (regex), aplica matching de termos com a mesma lógica de exclusão/case-insensitive já usada pelo Termos Paralela.
- Resposta: `{ matches: [{ processo, conteudo, hash, monitoramentoId, dataPublicacao }] }`.

### 4. Engine browser nova
- `useDjetPautasParalelaEngine.ts`: cópia estrutural do Paralela atual (singleton, subscribe, checkpoint, force kill, reset total) com:
  - Loop `tribunal → dia` (sem termo dentro — termos vão como lista para a edge function).
  - Lista fixa: `['TST', 'TRT1', ..., 'TRT24']`.
  - Insert em `publicacoes_djen` com `tipo_publicacao='pauta'`, `fonte='dejt-pdf'`.
  - Chaves de localStorage e nomes de eventos com prefixo **distinto** (`djet-pautas-*`) para não colidir com o Paralela.
- `useDjetPautasParalela.ts`: wrapper React (cópia simétrica).
- `useDjetPautasParalelaScheduler.ts`: cron diário opcional (cópia simétrica).

### 5. UI nova
- `src/components/configuracoes/MonitoramentoDjetPautasCard.tsx`: cópia visual do card Paralela. Título: "DJET Pautas Paralela (caderno Judiciário)".
- Inclusão do card em `Configuracoes.tsx`, **abaixo** do card Termos Paralela existente.

### 6. Análise/visualização
- Em `useAnaliseDjen.ts`: filtro opcional `tipoPublicacao: 'intimacao' | 'pauta' | 'todos'` (default `todos`, retrocompatível).
- Badge "Pauta" nas linhas de pauta.

## Pontos de atenção

- **Volume**: cadernos do TRT2/TRT15 podem ter 1000+ páginas → 30–60 s por PDF. A paralelização por tribunal cobre isso.
- **DEJT instável**: às vezes devolve HTML/erro → tratamento gracioso com `sem_dados:true`.
- **Feriados/dias sem caderno**: ignorar silenciosamente.
- **Dedup**: hash do bloco de pauta + nº processo evita duplicar quando o mesmo PDF cai para 2 monitoramentos.
- **Escopo**: só JT (TST + TRTs). STF/STJ/TJs ficam de fora — DEJT é exclusivo da Justiça do Trabalho.

## Entregáveis

1. Migration: coluna `tipo_publicacao` + índice
2. `supabase/functions/_shared/dejtTribunais.ts` (extração)
3. `supabase/functions/buscar-dejt-pautas/index.ts` (nova)
4. `src/hooks/useDjetPautasParalelaEngine.ts` (nova)
5. `src/hooks/useDjetPautasParalela.ts` (nova)
6. `src/hooks/useDjetPautasParalelaScheduler.ts` (nova)
7. `src/components/configuracoes/MonitoramentoDjetPautasCard.tsx` (nova)
8. Ajuste retrocompatível em `useAnaliseDjen.ts`
9. Inclusão do novo card em `Configuracoes.tsx`

**Zero alteração** em arquivos da DJEN Termos Paralela.
