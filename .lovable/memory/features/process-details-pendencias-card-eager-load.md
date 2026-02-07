# Memory: features/process-details-pendencias-card-eager-load
Updated: 2026-02-07

## Problema

O card de **Pendências do Processo** na página de detalhes do processo não mostrava tarefas, audiências ou intimações porque as queries estavam configuradas com lazy loading baseado na aba ativa (`enabled: activeTab === "tarefas"`).

Como o card de pendências aparece no **resumo** do processo (não em uma aba específica), os dados nunca eram carregados ao abrir a página.

## Solução

As queries de `audiências`, `intimações` e `tarefas` no `ProcessoDetalhes.tsx` foram alteradas para **eager loading**:

```typescript
// Antes - lazy load
enabled: !!id && activeTab === "tarefas"

// Depois - eager load
enabled: !!id
```

## Impacto

- O card de Pendências agora exibe corretamente audiências, intimações e tarefas pendentes
- O número total de queries iniciais aumenta, mas essas 3 queries são essenciais para a experiência do usuário
- A invalidação de queries com `queryKey: ["tarefas-processo", processoId]` funciona corretamente após criação de tarefas

## Arquivos Modificados

- `src/pages/ProcessoDetalhes.tsx`: Queries de audiências, intimações e tarefas passaram de lazy para eager loading
