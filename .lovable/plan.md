
# Plano: Timeout Inteligente + Heartbeat Intermediário (Solução 2 + 3)

## Problema Atual

O monitoramento de andamentos com 14.155+ processos está dando timeout após ~75 minutos porque:

1. **Timeout absoluto de 60 minutos** no orquestrador (`executar-monitoramento`) que ignora se o worker ainda está fazendo progresso
2. **Heartbeat atualizado apenas ao final de cada lote** (200 processos), o que pode levar tempo quando a API DataJud está lenta

## Solução Combinada

### Parte 1: Timeout Inteligente no Orquestrador

Modificar a lógica de timeout para considerar se há progresso recente:
- Se a execução está há mais de 60 minutos **E** não há heartbeat recente (5 min), aplicar timeout
- Se há progresso recente, deixar continuar independente do tempo total

**Arquivo**: `supabase/functions/executar-monitoramento/index.ts`

Alterar linhas 123-134 de:
```typescript
// Se está executando há mais de 60 minutos, marcar como timeout
if (minutosDecorridos > 60) {
  await supabase
    .from('execucoes_agendadas')
    .update({ ... })
    .eq('id', execucao.id);
  continue;
}
```

Para:
```typescript
// TIMEOUT INTELIGENTE: só aplicar timeout absoluto se TAMBÉM não houver progresso recente
// Isso permite execuções longas quando a API DataJud está lenta
if (minutosDecorridos > 60 && heartbeatStale) {
  console.log(`[${tipo}] Timeout após ${Math.round(minutosDecorridos)}min SEM progresso recente`);
  await supabase
    .from('execucoes_agendadas')
    .update({ 
      status: 'timeout', 
      finalizado_em: agora.toISOString(),
      ultimo_erro: `Timeout após ${Math.round(minutosDecorridos)} minutos sem progresso`
    })
    .eq('id', execucao.id);
  continue;
}
// Se há progresso recente, NÃO aplicar timeout (log para visibilidade)
if (minutosDecorridos > 60) {
  console.log(`[${tipo}] Execução há ${Math.round(minutosDecorridos)}min, mas com heartbeat ativo - continuando`);
}
```

---

### Parte 2: Heartbeat Intermediário no Worker

Adicionar atualização de `ultima_execucao` a cada 50 processos dentro do loop de processamento.

**Arquivo**: `supabase/functions/monitorar-andamentos/index.ts`

Após linha 1342 (depois do `Promise.all(batchPromises)`), adicionar:
```typescript
// HEARTBEAT INTERMEDIÁRIO: sinalizar vida ao orquestrador a cada 50 processos
// Evita timeout quando a API DataJud está lenta mas o worker ainda está processando
if (results.checked % 50 < PARALLEL_BATCH_SIZE) {
  await supabase
    .from('configuracoes_monitoramento')
    .update({ ultima_execucao: new Date().toISOString() })
    .eq('tipo', 'andamentos')
    .is('coordenacao_id', null);
  console.log(`[HEARTBEAT] Atualizado em ${results.checked}/${totalCount || 0} processos`);
}
```

---

### Verificação do Mecanismo de Retomada

O sistema **JÁ TEM** retomada funcionando:

1. **Checkpoint persistido**: O campo `next_offset` é salvo no metadata a cada lote (linha 1361):
```typescript
next_offset: results.cancelled ? currentOffset : (isComplete ? 0 : nextOffset)
```

2. **UI detecta checkpoint**: O `MonitoringDashboard` mostra botão "Retomar" quando:
   - `next_offset > 0`
   - Status é `timeout`, `failed`, `cancelled` ou `completed`

3. **Hook respeita retomada**: O `useExecutarMonitoramento` só zera offsets se `retomar = false` (linhas 79-86)

---

## Arquivos a Modificar

| Arquivo | Mudança | Linhas |
|---------|---------|--------|
| `supabase/functions/executar-monitoramento/index.ts` | Timeout inteligente (só se heartbeat stale) | 123-134 |
| `supabase/functions/monitorar-andamentos/index.ts` | Heartbeat intermediário a cada 50 processos | Após 1342 |

---

## Comportamento Esperado Após Implementação

| Cenário | Antes | Depois |
|---------|-------|--------|
| Execução de 2h com API lenta | Timeout aos 60min | Completa se há progresso |
| Worker travado (sem resposta) | Timeout aos 60min | Timeout aos 5min sem heartbeat |
| Execução interrompida no meio | Retomável (já funciona) | Retomável (sem mudança) |
| Cancelamento pelo usuário | Funciona | Funciona (sem mudança) |

---

## Resultado Final

- 14k+ processos poderão ser processados mesmo se levar 2+ horas
- Processos realmente travados ainda serão detectados (5min sem heartbeat)
- UI continuará mostrando progresso em tempo real
- Botão "Retomar" continuará funcionando para interrupções
