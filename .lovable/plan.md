
# Plano: Refatorar Monitoramento DJEN com Fases e Retomada

## Diagnóstico do Problema

Analisei a arquitetura atual e identifiquei as seguintes questões:

### 1. Card mostrando execução antiga (26/01)
- **Causa**: O campo `ultima_execucao` na tabela `configuracoes_monitoramento` só é atualizado quando a execução conclui com sucesso
- **O hook `useBuscaDjenDireta`** não registra execuções no banco `execucoes_agendadas`, então cancelamentos não aparecem
- **A linha 391 do `DjenTermosDashboardCard`** exibe `stats.lastCompletedExecution?.iniciado_em` que pega apenas execuções finalizadas

### 2. Falta de retomada após cancelamento
- Ao cancelar (`cancelarExecucao`), o hook limpa completamente o localStorage
- Não salva o checkpoint (monitoramento atual processado) antes de limpar
- Não há lógica para retomar do ponto onde parou

### 3. Monitoramento em fase única
- Todo o processamento acontece em um loop único (`for i < monitoramentos.length`)
- Não há separação entre busca de publicações vs identificação de intimações/audiências

---

## Mudanças Propostas

### Parte 1: Mostrar sempre a última execução (independente do status)

**Arquivos a modificar:**
- `src/hooks/useBuscaDjenDireta.ts`
- `src/components/configuracoes/DjenTermosDashboardCard.tsx`

**Implementação:**
1. Ao **iniciar** uma execução, salvar um registro em `execucoes_agendadas` com status `executando`
2. Ao **cancelar**, atualizar o registro para status `cancelado` (não apenas limpar localStorage)
3. Ao **concluir**, atualizar o registro para status `concluido`
4. O card exibirá a execução mais recente **de qualquer status** (não apenas concluídas)

```text
┌─────────────────────────────────────────────────────┐
│  DjenTermosDashboardCard                            │
│  ┌──────────────────────────────────────────────┐  │
│  │ Última execução: 29/01/2026, 10:35           │  │
│  │ Status: Cancelado                            │  │
│  │ Progresso: 45/114 (39%)                      │  │
│  │ [Retomar de 45]  [Executar do zero]          │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

### Parte 2: Retomada após cancelamento (mesmo dia)

**Arquivos a modificar:**
- `src/hooks/useBuscaDjenDireta.ts`

**Implementação:**
1. Ao cancelar, **preservar** o checkpoint no localStorage (monitoramentos processados)
2. Adicionar parâmetro `retomar?: boolean` ao método `executarMonitoramento`
3. Se `retomar = true` E houver checkpoint do mesmo dia:
   - Carregar lista de monitoramentos já processados do localStorage
   - Continuar a partir do próximo monitoramento não processado
4. Se `retomar = false`:
   - Limpar checkpoint e começar do zero

**Estrutura do checkpoint (localStorage):**
```typescript
interface CheckpointDjen {
  data: string; // '2026-01-29' - data da execução
  monitoramentosProcessados: string[]; // IDs já processados
  totalNovas: number;
  totalDuplicadas: number;
  tempoAcumulado: number; // segundos
}
```

**Lógica de retomada:**
```text
Usuário clica "Executar"
    │
    ├── Existe checkpoint do mesmo dia?
    │       │
    │       ├── SIM → Perguntar: "Retomar de X% ou começar do zero?"
    │       │              │
    │       │              ├── Retomar → Pular monitoramentos já processados
    │       │              └── Do zero → Limpar checkpoint, executar tudo
    │       │
    │       └── NÃO → Executar normalmente do zero
```

---

### Parte 3: Divisão em Fases

**Arquivos a criar/modificar:**
- `src/hooks/useBuscaDjenDireta.ts` (refatorar)
- Criar novo tipo `FaseDjen`

**Estrutura de fases:**

| Fase | Nome | Descrição | Implementação |
|------|------|-----------|---------------|
| 1 | Busca Publicações | Buscar publicações por termos no DJEN | Atual (já existe) |
| 2 | Identificar Eventos | Analisar conteúdo para detectar intimações, audiências, citações | Novo - usar IA ou regex |
| 3 | Notificações | Enviar resumos por coordenação | Atual (já existe no final) |

**Nova interface de progresso:**
```typescript
interface ProgressoExecucao {
  faseAtual: 1 | 2 | 3;
  fasesConfig: {
    fase1: { total: number; processados: number; status: 'pendente' | 'executando' | 'concluido' };
    fase2: { total: number; processados: number; status: 'pendente' | 'executando' | 'concluido' };
    fase3: { total: number; processados: number; status: 'pendente' | 'executando' | 'concluido' };
  };
  // ... campos existentes
}
```

**UI do card com fases:**
```text
┌────────────────────────────────────────────────────────────┐
│  DJEN Termos                               ⊙ Executando    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Fase 1: Buscar Publicações      ✓ Concluído (114)   │ │
│  │  Fase 2: Identificar Eventos     ⟳ 23/121 (19%)      │ │
│  │  Fase 3: Enviar Notificações     ○ Pendente          │ │
│  └──────────────────────────────────────────────────────┘ │
│  Progresso geral: 56%   |   Tempo: 2m 34s                 │
└────────────────────────────────────────────────────────────┘
```

---

## Detalhes Técnicos

### Alterações no `useBuscaDjenDireta.ts`

1. **Novo estado para checkpoint:**
```typescript
interface CheckpointDjen {
  data: string;
  monitoramentosProcessados: string[];
  totalNovas: number;
  totalDuplicadas: number;
  faseAtual: number;
}
```

2. **Modificar `cancelarExecucao`:**
- Salvar checkpoint antes de limpar
- Registrar no banco `execucoes_agendadas` como cancelado

3. **Modificar `executarMonitoramento`:**
- Aceitar parâmetro `retomar: boolean`
- Se `retomar` E houver checkpoint válido do mesmo dia:
  - Filtrar monitoramentos já processados
  - Continuar acumulando totais

4. **Nova função `identificarEventos` (Fase 2):**
- Iterar sobre publicações encontradas na Fase 1
- Usar regex ou IA para detectar:
  - Intimações (palavras-chave: "INTIMAÇÃO", "INTIMO", "CUMPRA-SE")
  - Audiências (palavras-chave: "AUDIÊNCIA", "DESIGNO", "data e hora")
  - Citações (palavras-chave: "CITAÇÃO", "CITE-SE")

### Alterações no `DjenTermosDashboardCard.tsx`

1. **Exibir última execução de qualquer status:**
```typescript
// Atual: busca apenas concluídas
const lastExec = stats.currentExecution || stats.lastCompletedExecution;

// Novo: buscar a mais recente independente do status
const lastExec = executions
  .filter(e => e.tipo === 'djen')
  .sort((a, b) => new Date(b.iniciado_em).getTime() - new Date(a.iniciado_em).getTime())[0];
```

2. **Botões de retomada:**
```typescript
{hasCheckpoint && (
  <div className="flex gap-2">
    <Button onClick={() => executar(true)}>
      Retomar de {checkpointPercent}%
    </Button>
    <Button variant="outline" onClick={() => executar(false)}>
      Começar do zero
    </Button>
  </div>
)}
```

3. **Indicador de fases:**
- Mostrar stepper visual com 3 fases
- Highlight da fase atual
- Checkmark nas fases concluídas

---

## Ordem de Implementação

1. **Primeira entrega: Registrar execuções no banco**
   - Modificar `useBuscaDjenDireta` para criar/atualizar `execucoes_agendadas`
   - Card exibe última execução de qualquer status

2. **Segunda entrega: Retomada de checkpoint**
   - Salvar checkpoint ao cancelar
   - Botão "Retomar" quando houver checkpoint do mesmo dia

3. **Terceira entrega: Divisão em fases**
   - Separar busca (Fase 1) de identificação (Fase 2)
   - UI com indicador de fases

---

## Migração de Dados

Nenhuma alteração de schema necessária. O `execucoes_agendadas` já suporta todos os campos necessários:
- `tipo: 'djen'`
- `status: 'executando' | 'concluido' | 'cancelado' | 'timeout'`
- `detalhes: { checkpoint, faseAtual, ... }`
