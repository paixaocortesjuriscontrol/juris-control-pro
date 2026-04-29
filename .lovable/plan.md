## Objetivo

Eliminar o cálculo de duplicação/descarte em runtime adicionando um atributo `status` persistido nas tabelas DJEN, com índices, para que a tela Análise DJEN abra instantaneamente.

## Causa raiz confirmada

| Tabela | Linhas |
|---|---|
| `publicacoes_djen` | 39.523 |
| `publicacoes_djen` (linhas únicas reais) | **21.984** |
| Duplicadas calculadas em runtime | **17.539** |
| `publicacoes_djen_descartadas` | 155.860 |
| `publicacoes_djen_processos` | 2.484 |

Toda vez que a tela abre, o Postgres precisa rodar `regexp_replace` + `DISTINCT ON` em ~42 mil linhas para descobrir quais são duplicadas — isso estoura o `statement_timeout`.

## Mudança

### 1. Novo atributo `status` (enum) nas três tabelas

```sql
CREATE TYPE djen_status AS ENUM ('encontrada', 'descartada', 'duplicada');

ALTER TABLE publicacoes_djen           ADD COLUMN status djen_status NOT NULL DEFAULT 'encontrada';
ALTER TABLE publicacoes_djen_processos ADD COLUMN status djen_status NOT NULL DEFAULT 'encontrada';
```

> Observação: hoje as descartadas ficam em `publicacoes_djen_descartadas` (uma tabela inteira separada, com 155k linhas). O plano inclui **trazer essas linhas de volta** para `publicacoes_djen` marcadas com `status = 'descartada'`, padronizando tudo num único lugar com filtro por atributo.

### 2. Backfill (uma única vez)

- **Marcar duplicadas**: para cada grupo `(coordenacao_id, processo_numero_normalizado, data)`, manter a mais antiga como `'encontrada'` e marcar as demais como `'duplicada'` (≈17.539 linhas)
- **Importar descartadas**: mover linhas de `publicacoes_djen_descartadas` para `publicacoes_djen` com `status = 'descartada'`, preservando IDs e relacionamentos
- Mesma lógica para `publicacoes_djen_processos`

### 3. Índices parciais

```sql
CREATE INDEX idx_djen_encontrada ON publicacoes_djen (coordenacao_id, created_at DESC) WHERE status = 'encontrada';
CREATE INDEX idx_djen_status     ON publicacoes_djen (coordenacao_id, status, created_at DESC);
-- equivalentes em publicacoes_djen_processos
```

### 4. Trigger de inserção

Trigger `BEFORE INSERT` que:
- Calcula `dedup_key` na hora
- Procura outra linha com o mesmo dedup_key + status = 'encontrada'
- Se achar → marca a nova como `'duplicada'`
- Senão → mantém `'encontrada'`

Resultado: nunca mais haverá duplicada não-marcada na base.

### 5. Reescrever as RPCs

- `get_djen_stats_per_user`: substituir o `DISTINCT ON` + `UNION` pesado por `COUNT(*) WHERE status = 'encontrada'` (ou `'descartada'` quando o filtro pede). Usa o índice parcial direto.
- `get_djen_publicacoes_unificadas`: idem — `WHERE status = 'encontrada'` + `LIMIT/OFFSET`. Sem dedup em runtime.

### 6. Atualizar o hook `usePublicacoesDjenUnificadas.ts`

- Quando o filtro for "Descartadas (auditoria)", consultar `publicacoes_djen WHERE status = 'descartada'` (em vez da tabela separada)
- Quando for normal, consultar `WHERE status = 'encontrada'`
- Cards de totalizadores leem direto pelos índices parciais

### 7. Aposentar `publicacoes_djen_descartadas`

Após o backfill e a confirmação visual de que tudo está funcionando:
- Renomear para `publicacoes_djen_descartadas_legacy` (não dropar de cara — segurança)
- Pode ser dropada manualmente depois se você quiser

## Resultado esperado

| Operação | Antes | Depois |
|---|---|---|
| Card "Total Hoje" sem filtro | timeout | < 30ms |
| Listagem página 1 | 8-30s ou timeout | < 200ms |
| Paginação 500+500+500+390 | quebrada | funciona |

## O que NÃO muda

- Comportamento visual da tela
- Filtros existentes (Lidas/Não lidas/Todas/Descartadas)
- Isolamento por coordenação
- Leituras por usuário (continuam em `publicacoes_djen_leituras`)
- Nenhum dado é perdido — descartadas voltam pra base unificada com flag

## Ordem de execução

1. Migração: criar enum + colunas + índices parciais
2. Backfill em lotes (5k linhas por vez) para marcar duplicadas e importar descartadas
3. Criar trigger de auto-marcação na inserção
4. Reescrever as duas RPCs
5. Ajustar `usePublicacoesDjenUnificadas.ts` para usar `status` em vez da tabela separada
6. Renomear tabela legada para `_legacy`
