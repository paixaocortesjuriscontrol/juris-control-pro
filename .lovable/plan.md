## Diagnóstico

A busca DJEN Pautas Servidor **está passando a data BRT correta** (`2026-07-03`) para os DEJTs. Verificado:

- `brtNow()` em `executar-djet-pautas-agendado/index.ts:32-38` usa `toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })` — sempre BRT.
- A execução de hoje (`ac762183…`, `iniciado_em 12:00 UTC = 09:00 BRT`) tem `janela: { dataInicio: "2026-07-03", dataFim: "2026-07-03" }` — correto.
- 41 publicações de pauta inseridas hoje.

**Porém**: no banco, `publicacoes_djen_servidor.data_disponibilizacao` foi gravada como `2026-07-03 00:00:00+00` (meia-noite UTC). Como a coluna é `timestamptz` e o front renderiza em BRT (UTC-3), esse valor vira **02/07/2026 21:00 BRT** — daí a advogada vê "data de ontem".

Causa: linha 283 grava `m.dataPublicacao` como string YMD (`"2026-07-03"`), que o Postgres interpreta como `00:00:00 UTC`. O mesmo acontece com `data_publicacao` na linha 284. Já existe convenção no projeto (memória `djen-publication-date-and-timezone-normalization`) de normalizar para **12:00 UTC** para que o dia BRT seja igual ao dia UTC.

## Plano

### 1. Corrigir gravação em `executar-djet-pautas-agendado/index.ts` (persistMatches)

Trocar as duas linhas do insert:

```ts
data_disponibilizacao: m.dataPublicacao,
data_publicacao: calcularDataPublicacaoYmd(m.dataPublicacao),
```

por:

```ts
data_disponibilizacao: `${m.dataPublicacao}T12:00:00Z`,
data_publicacao: `${calcularDataPublicacaoYmd(m.dataPublicacao)}T12:00:00Z`,
```

Isso mantém o dia BRT igual ao dia UTC (12:00 UTC = 09:00 BRT, ambos = mesma data).

### 2. Backfill das pautas gravadas hoje com timestamp errado

Migração pontual para consertar as ~41 linhas de hoje (e ontem, se houver o mesmo problema):

```sql
UPDATE publicacoes_djen_servidor
SET data_disponibilizacao = date_trunc('day', data_disponibilizacao) + interval '12 hours',
    data_publicacao       = date_trunc('day', data_publicacao)       + interval '12 hours'
WHERE tipo_publicacao = 'pauta'
  AND created_at > now() - interval '3 days'
  AND extract(hour from data_disponibilizacao at time zone 'UTC') = 0;
```

(Filtro `hour = 0` evita mexer em linhas já normalizadas.)

### 3. Verificar simetria com Termos Servidor

Ler rapidamente o insert de `publicacoes_djen_servidor` no motor de Termos para confirmar se ele já usa `T12:00:00Z`. Se estiver usando o mesmo padrão errado (YMD puro), aplicar a mesma correção — mas **sem alterar comportamento de busca**, só o formato do timestamp gravado.

### 4. Verificação

- Rodar novo scheduler manualmente (`force: true`) para uma coordenação e conferir no banco que `data_disponibilizacao` fica `2026-07-03 12:00:00+00`.
- No front, a pauta deve aparecer como `03/07/2026`.

## O que NÃO muda

- Lógica de busca DEJT / janela de datas / horários do dispatcher.
- Regras de dedup, coordenação, `calcularDataPublicacaoYmd` (recesso, fins de semana).
- Isolamento Browser × Servidor.
- Nenhuma alteração no motor Termos além do ajuste de gravação (item 3), se for o caso.
