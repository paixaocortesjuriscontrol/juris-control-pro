
# Plano: Correção da Inconsistência de Contagem DJEN (99 vs 43)

## Diagnóstico

### Problema Identificado
Existem **dois problemas distintos** causando confusão:

| Local | Valor Exibido | Fonte do Dado | Motivo |
|-------|---------------|---------------|--------|
| Card Dashboard | 99 | `publicacoes_djen` bruto | Conta registros sem deduplicação |
| Tela Análise | 43 | `dedupePublicacoesDjen()` | Aplica deduplicação por coord+processo+data+conteúdo |

**Causa raiz:** O hook `useMonitoringDashboard.ts` conta registros brutos do banco:
```typescript
// Linhas 150-154 - Conta TODOS os registros sem dedup
const { count: djenNovas } = await supabase
  .from('publicacoes_djen')
  .select('*', { count: 'exact', head: true })
  .gte('created_at', inicioDia)
  .lte('created_at', fimDia);
```

A tela de Análise usa `usePublicacoesDjenUnificadas.ts` que aplica `dedupePublicacoesDjen()`:
```typescript
// Linha 576 - Aplica deduplicação
let deduped = dedupePublicacoesDjen(resultados);
```

### Por que existem duplicatas?
A query no banco mostra que existem **múltiplos monitoramentos com o mesmo termo** (ex: 14 monitoramentos "OSMAR MENDES PAIXAO"). Cada um pode capturar a mesma publicação, gerando duplicatas.

```text
Banco hoje:
- Total bruto: 99 registros
- Após dedup: 43 publicações únicas
```

---

## Solução Proposta

### Estratégia
Fazer o card do dashboard mostrar o **valor deduplicado** (43) em vez do bruto (99), para consistência com a tela de Análise.

### Opção Implementada: RPC de Contagem Deduplicada
Criar uma função RPC que conta publicações únicas usando a mesma lógica de deduplicação do frontend.

---

## Arquivos a Modificar

### 1. Nova Migração SQL - RPC de Contagem Deduplicada

Criar função `count_djen_publicacoes_deduplicadas_hoje` que:
- Aplica a mesma lógica de hash: `coordenacao_id || processo_digits || data || head`
- Retorna contagem de combinações únicas

```sql
CREATE OR REPLACE FUNCTION count_djen_publicacoes_deduplicadas_hoje()
RETURNS TABLE(total_unicas bigint, total_bruto bigint)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_inicio timestamptz;
  v_fim timestamptz;
BEGIN
  v_inicio := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
  v_fim := v_inicio + interval '1 day';
  
  RETURN QUERY
  WITH pub_base AS (
    SELECT
      m.coordenacao_id,
      regexp_replace(COALESCE(p.processo_numero, ''), '[^0-9]', '', 'g') AS processo_digits,
      COALESCE(
        to_char(p.data_disponibilizacao::date, 'YYYY-MM-DD'),
        to_char(p.data_publicacao::date, 'YYYY-MM-DD'),
        to_char(p.created_at::date, 'YYYY-MM-DD')
      ) AS data_ref,
      left(
        lower(regexp_replace(regexp_replace(
          COALESCE(p.conteudo, ''), '<[^>]*>', ' ', 'g'
        ), '\s+', ' ', 'g')),
        300
      ) AS head_norm
    FROM publicacoes_djen p
    JOIN monitoramentos_djen m ON m.id = p.monitoramento_id
    WHERE p.created_at >= v_inicio AND p.created_at < v_fim
  )
  SELECT
    COUNT(DISTINCT (
      COALESCE(coordenacao_id::text, 'sem_coord') || '|' ||
      processo_digits || '|' ||
      data_ref || '|' ||
      head_norm
    ))::bigint AS total_unicas,
    COUNT(*)::bigint AS total_bruto
  FROM pub_base;
END;
$$;
```

### 2. `src/hooks/useMonitoringDashboard.ts`

Modificar a query `monitoring-real-db-stats` para usar a RPC deduplicada:

**Antes:**
```typescript
const { count: djenNovas } = await supabase
  .from('publicacoes_djen')
  .select('*', { count: 'exact', head: true })
  .gte('created_at', inicioDia)
  .lte('created_at', fimDia);
```

**Depois:**
```typescript
// Usar RPC para contagem deduplicada (consistente com tela de Análise)
const { data: djenStats } = await supabase
  .rpc('count_djen_publicacoes_deduplicadas_hoje');

const djenNovasDedup = djenStats?.[0]?.total_unicas ?? 0;
```

### 3. `src/components/configuracoes/DjenTermosDashboardCard.tsx`

Adicionar label esclarecendo que o valor é deduplicado:

**Linha 665-668 - Alterar label "Encontrados" para "Publicações":**
```typescript
<div className="bg-background/60 rounded-lg p-2.5 text-center border">
  <div className="text-xs text-muted-foreground mb-0.5">Publicações</div>
  <div className="text-lg font-bold font-mono text-green-600">
    {encontrados.toLocaleString('pt-BR')}
  </div>
</div>
```

### 4. `src/constants/version.ts`

Atualizar versão para refletir a correção:
```typescript
export const VERSION = "1.0.6";
```

---

## Fluxo de Dados Após Correção

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Banco de Dados                               │
│  publicacoes_djen: 99 registros brutos hoje                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │    RPC count      │
                    │  (deduplicação)   │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  43 únicas        │
                    └─────────┬─────────┘
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
┌─────────────────┐                   ┌─────────────────┐
│  Card Dashboard │                   │  Tela Análise   │
│      43         │                   │      43         │
│   (consistente) │                   │   (consistente) │
└─────────────────┘                   └─────────────────┘
```

---

## Benefícios

1. **Consistência:** Card e Tela de Análise mostram o mesmo número
2. **Transparência:** Usuário entende que 43 são publicações únicas
3. **Performance:** RPC executa a contagem no servidor (mais eficiente)
4. **Manutenibilidade:** Lógica de dedup centralizada no banco

---

## Considerações Técnicas

### Sobre o Status 93% "Concluído"
O banco mostra `metadata.status = 'timeout'`, que está correto. A UI já deveria exibir "Timeout" se a lógica de status estiver funcionando. Se ainda mostrar "Concluído", pode ser cache do React Query. A invalidação de queries após a correção deve resolver.

### Validação da Correção
Após a implementação:
- Card mostrará **43** em vez de 99
- Tela de Análise continuará mostrando **43**
- Os números serão **idênticos**

---

## Resumo das Alterações

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `migrations/xxx_count_djen_dedup.sql` | NOVO | RPC para contagem deduplicada |
| `src/hooks/useMonitoringDashboard.ts` | MODIFICAR | Usar RPC em vez de COUNT bruto |
| `src/components/configuracoes/DjenTermosDashboardCard.tsx` | MODIFICAR | Alterar label para "Publicações" |
| `src/constants/version.ts` | MODIFICAR | Atualizar para 1.0.6 |
