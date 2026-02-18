
# Diagnóstico completo: envio de resumos por coordenação ao finalizar

## Situação atual por tipo de monitoramento

Após inspecionar todos os engines e edge functions, o mapa real é:

| Tipo | Canal de execução | Envia resumo? | Problema |
|---|---|---|---|
| DJEN Termos | Browser (engine) | Tentativa implementada | Join `monitoramentos_djen!inner` quebrado — sem FK registrada no banco, a query retorna 0 publicações |
| DJEN Processos | Edge function backend | Funciona corretamente | Nenhum |
| DJEN Processos | Browser (engine) | Não envia | O motor browser finaliza sem chamar `enviar-resumo-monitoramento` |
| Andamentos | Edge function | Funciona | Nenhum |
| Redistribuições | Edge function | Funciona | Nenhum |
| Distribuições | Edge function | Não envia | O loop de conclusão (linha 673-691) salva histórico mas nunca chama `enviar-resumo-monitoramento` |

## Problema 1 — DJEN Termos: join quebrado

A função `enviarResumoDjenPorCoordenacao` usa:

```typescript
.select(`
  id,
  processo_numero,
  conteudo,
  monitoramentos_djen!inner (   ← FK não registrada nos metadados do banco
    id,
    coordenacao_id,
    coordenacoes (id, nome)
  )
`)
```

O Supabase client resolve joins implícitos consultando os metadados de FK do banco (`information_schema`). Como a FK de `publicacoes_djen.monitoramento_id` → `monitoramentos_djen.id` não está registrada como constraint formal, o join falha silenciosamente e retorna 0 linhas.

**Solução**: Substituir por duas queries separadas:
1. Buscar publicações do período → obter lista de `monitoramento_id` únicos
2. Buscar `monitoramentos_djen` por esses IDs com join em `coordenacoes`
3. Cruzar em memória por `monitoramento_id`

Arquivo: `src/hooks/useDjenTermosEngine.ts`

## Problema 2 — DJEN Processos no browser: sem envio de resumo

O engine browser (`src/hooks/useDjenProcessosEngine.ts`) ao concluir (linha ~680) apenas mostra um `toast.success()`. O resumo por coordenação só é enviado quando o **backend** (`monitorar-djen-processos`) executa. Se o usuário rodar via browser, nenhum resumo é enviado.

**Solução**: Após a conclusão com `novasTotal > 0`, adicionar chamada a `enviarResumoDjenProcessosPorCoordenacao()` no engine browser, similar ao que foi feito para DJEN Termos, mas consultando `publicacoes_djen_processos` com join em `processos` (FK formal existe).

Arquivo: `src/hooks/useDjenProcessosEngine.ts`

## Problema 3 — Distribuições: loop de conclusão sem envio

Na edge function `monitorar-distribuicoes`, quando `isComplete = true` (linha 673), o código:
- ✅ Salva no `historico_monitoramento`
- ❌ NÃO chama `enviar-resumo-monitoramento`

O loop processa todos os lotes mas nunca consolida e envia o resumo.

**Solução**: Após o `break` do loop de conclusão (após salvar histórico), adicionar bloco para buscar as distribuições do dia agrupadas por coordenação e chamar `enviar-resumo-monitoramento`.

Arquivo: `supabase/functions/monitorar-distribuicoes/index.ts`

## Implementação

### Mudança 1 — `src/hooks/useDjenTermosEngine.ts`

Substituir o join quebrado por duas queries separadas dentro de `enviarResumoDjenPorCoordenacao`:

```typescript
// Query 1: buscar publicações do período
const { data: publicacoes } = await supabase
  .from('publicacoes_djen')
  .select('id, processo_numero, conteudo, monitoramento_id, created_at')
  .gte('created_at', dataInicio)
  .lte('created_at', dataFim);

// Extrair IDs únicos de monitoramento
const monitoramentoIds = [...new Set(
  (publicacoes || []).map(p => (p as any).monitoramento_id).filter(Boolean)
)];

if (monitoramentoIds.length === 0) return;

// Query 2: buscar monitoramentos com coordenação
const { data: monitoramentos } = await supabase
  .from('monitoramentos_djen')
  .select('id, coordenacao_id, coordenacoes(id, nome)')
  .in('id', monitoramentoIds);

// Cruzar em memória
const monMap = new Map<string, { coordenacao_id: string; coordenacao_nome: string }>();
for (const m of monitoramentos || []) {
  monMap.set(m.id, {
    coordenacao_id: m.coordenacao_id,
    coordenacao_nome: (m as any).coordenacoes?.nome || 'Sem nome',
  });
}
```

Também adicionar o campo `total_verificados: coord.total_encontrados` que faltava no payload.

### Mudança 2 — `src/hooks/useDjenProcessosEngine.ts`

Adicionar função `enviarResumoDjenProcessosPorCoordenacao` e chamá-la ao concluir:

```typescript
// Ao concluir (após toast.success)
if (novasTotal > 0) {
  await enviarResumoDjenProcessosPorCoordenacao();
}
```

A função busca em `publicacoes_djen_processos` as publicações do dia, faz join com `processos` (FK formal existe, funciona), agrupa por coordenação e chama `enviar-resumo-monitoramento` com `tipo_monitoramento: 'djen_processos'`.

### Mudança 3 — `supabase/functions/monitorar-distribuicoes/index.ts`

Dentro do bloco `if (isComplete)` (após salvar histórico), adicionar envio de resumo:

```typescript
if (totalNovasDistribuicoes > 0) {
  // Buscar distribuições do dia agrupadas por coordenação
  const { data: distribsHoje } = await supabase
    .from('historico_distribuicoes')  // ou tabela correspondente
    .select(...)
    .gte('created_at', inicioHoje);

  // Montar resumosPorCoordenacao e chamar enviar-resumo-monitoramento
  await fetch(`${supabaseUrl}/functions/v1/enviar-resumo-monitoramento`, {
    method: 'POST',
    body: JSON.stringify({
      tipo_monitoramento: 'distribuicoes',
      resumos_por_coordenacao: resumos,
    })
  });
}
```

## Arquivos a modificar

1. `src/hooks/useDjenTermosEngine.ts` — corrigir join quebrado por duas queries separadas + adicionar `total_verificados`
2. `src/hooks/useDjenProcessosEngine.ts` — adicionar função de envio de resumo ao concluir no motor browser
3. `supabase/functions/monitorar-distribuicoes/index.ts` — adicionar bloco de envio de resumo no loop de conclusão

## Resultado esperado

- DJEN Termos: ao concluir com novas publicações, envia resumo por email/WhatsApp por coordenação
- DJEN Processos (browser): ao concluir, envia resumo por coordenação (mesmo comportamento do backend)
- Andamentos: já funciona (nenhuma mudança)
- Redistribuições: já funciona (nenhuma mudança)
- Distribuições: ao concluir run completo, envia resumo por coordenação

Todos os envios respeitam as configurações da `config_alertas_coordenacao`: canal (email/WhatsApp), horário, dias da semana e tipos de alerta habilitados.
