
# Plano: Exclusão Santander + Refatoração DJEN Processos

## 1. Contexto Atual

### Volume de Dados:
| Coordenação | Total Processos | monitorar_djen |
|-------------|-----------------|----------------|
| Santander Cível | 10.736 | 10.736 (100%) |
| Santander Trabalhista | 998 | 0 |
| Dra. Janaina | 2.412 | 2.357 |
| Dr. Thomás | 518 | 57 |
| Dra. Polyana | 60 | 60 |

**Impacto da exclusão Santander:** De ~13.210 processos para ~2.474 (redução de 81%)

### IDs das Coordenações a Excluir:
- Santander Cível: `968631d0-6659-46f1-b45d-899892cb0121`
- Santander Trabalhista: `70d3e1ba-70ff-46d0-a6cf-4d4b553d324a`

---

## 2. Alteração 1: Filtrar Coordenações Santander

### 2.1 Modificar o Hook de Browser
**Arquivo:** `src/hooks/useMonitorarDjenProcessosBrowser.ts`

Na query de processos monitorados (linha ~327), adicionar filtro para excluir as coordenações Santander:

```typescript
// Coordenações excluídas do DJEN Processos (volume muito alto)
const COORDENACOES_EXCLUIDAS = [
  '968631d0-6659-46f1-b45d-899892cb0121', // Santander Cível
  '70d3e1ba-70ff-46d0-a6cf-4d4b553d324a', // Santander Trabalhista
];

const { data: processosMonitorados, error: procError } = await supabase
  .from('processos')
  .select('id, numero, coordenacao_id')
  .eq('monitorar_djen', true)
  .not('coordenacao_id', 'in', `(${COORDENACOES_EXCLUIDAS.join(',')})`);
```

### 2.2 Atualizar Estatísticas do Card
**Arquivo:** `src/components/configuracoes/MonitoramentoDjenProcessosCard.tsx`

Ajustar a query de estatísticas para refletir apenas processos elegíveis:

```typescript
const { count: processosMonitorados } = await supabase
  .from('processos')
  .select('*', { count: 'exact', head: true })
  .eq('monitorar_djen', true)
  .not('coordenacao_id', 'in', `(${COORDENACOES_EXCLUIDAS.join(',')})`);
```

---

## 3. Alteração 2: Arquitetura Singleton (como DJEN Termos)

### 3.1 Criar Engine Singleton
**Novo arquivo:** `src/hooks/useDjenProcessosEngine.ts`

Seguindo o padrão do `useDjenTermosEngine.ts`:

```text
┌─────────────────────────────────────────────────────────────┐
│                  SINGLETON STATE (global)                    │
├─────────────────────────────────────────────────────────────┤
│ • isRunning: boolean                                         │
│ • progress: DjenProcessosProgress                            │
│ • checkpoint: { grupoIdx, novas, duplicadas, runKey }       │
│ • abortController: AbortController | null                    │
│ • listeners: Set<(p) => void>                               │
│ • timerInterval: NodeJS.Timer | null                        │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    API PÚBLICA                               │
├─────────────────────────────────────────────────────────────┤
│ executarDjenProcessos(dataInicio?, dataFim?, retomar?)      │
│ cancelarDjenProcessos()                                      │
│ limparEstadoDjenProcessos()                                  │
│ forceKillDjenProcessos()                                     │
│ subscribeDjenProcessos(listener) → unsubscribe              │
│ getDjenProcessosProgress() → DjenProcessosProgress           │
│ isDjenProcessosRunning() → boolean                           │
│ getCheckpointProcessos() → Checkpoint | null                 │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Características da Nova Engine

1. **Persistência ao Sair da Tela**
   - Estado global em módulo (não React state)
   - Timer continua rodando mesmo navegando para outra página
   - Checkpoint salvo em localStorage + banco

2. **Checkpoint por Grupo**
   ```typescript
   interface Checkpoint {
     runKey: string;           // "YYYY-MM-DD..YYYY-MM-DD"
     grupoIdx: number;         // índice do grupo (0-based)
     novas: number;
     duplicadas: number;
     tempoInicio: number;
     dataInicioYmd: string;
     dataFimYmd: string;
   }
   ```

3. **Progresso Monotônico**
   - Usa `run_key` para identificar execução
   - Nunca regride percentual (Math.max)
   - UI sempre mostra o maior valor entre local e banco

4. **Retomada Manual**
   - Sem auto-restart ao detectar checkpoint antigo
   - Usuário decide quando continuar via botão "Continuar"

### 3.3 Fluxo de Execução

```text
┌──────────┐    ┌────────────────┐    ┌──────────────────┐
│ Iniciar  │───▶│ Carregar       │───▶│ Dividir em       │
│ Execução │    │ Processos      │    │ Grupos de 10     │
└──────────┘    │ (excl. Sant.)  │    └──────────────────┘
                └────────────────┘             │
                                               ▼
┌──────────────────────────────────────────────────────────┐
│                    LOOP DE GRUPOS                         │
├──────────────────────────────────────────────────────────┤
│ Para cada grupo:                                          │
│   1. Montar query OR (proc1 OR proc2 OR ...)             │
│   2. Buscar no PJE Comunica (com retries)                │
│   3. Processar publicações encontradas                    │
│   4. Salvar checkpoint (a cada 5 grupos)                 │
│   5. Atualizar metadata no banco (throttled)             │
│   6. Verificar cancelamento                              │
│   7. Delay entre grupos (respeitando parâmetros)         │
└──────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                    FINALIZAÇÃO                            │
├──────────────────────────────────────────────────────────┤
│ • Limpar checkpoint (se concluído)                        │
│ • Atualizar status no banco                               │
│ • Registrar histórico                                     │
│ • Notificar listeners                                     │
└──────────────────────────────────────────────────────────┘
```

### 3.4 Hook React (wrapper)
**Novo arquivo:** `src/hooks/useDjenProcessos.ts`

Hook que conecta o componente React à engine singleton:

```typescript
export function useDjenProcessos() {
  const [progress, setProgress] = useState(getDjenProcessosProgress());
  
  useEffect(() => {
    return subscribeDjenProcessos(setProgress);
  }, []);
  
  return {
    progress,
    isRunning: isDjenProcessosRunning(),
    executar: executarDjenProcessos,
    cancelar: cancelarDjenProcessos,
    limpar: limparEstadoDjenProcessos,
    forceKill: forceKillDjenProcessos,
  };
}
```

### 3.5 Atualizar Card
**Arquivo:** `src/components/configuracoes/MonitoramentoDjenProcessosCard.tsx`

Trocar o hook atual pelo novo:

```typescript
// ANTES:
import { useMonitorarDjenProcessosBrowser } from "@/hooks/useMonitorarDjenProcessosBrowser";

// DEPOIS:
import { useDjenProcessos } from "@/hooks/useDjenProcessos";
```

---

## 4. Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/hooks/useDjenProcessosEngine.ts` | **NOVO** - Engine singleton |
| `src/hooks/useDjenProcessos.ts` | **NOVO** - Hook React wrapper |
| `src/hooks/useMonitorarDjenProcessosBrowser.ts` | Manter (compatibilidade) ou deprecar |
| `src/components/configuracoes/MonitoramentoDjenProcessosCard.tsx` | Atualizar imports e lógica |

---

## 5. Benefícios Esperados

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Processos | ~13.210 | ~2.474 |
| Grupos (÷10) | ~1.321 | ~248 |
| Tempo estimado | 40-60 min | ~10 min |
| Persiste ao sair? | Não | Sim |
| Checkpoint | Parcial | Completo |
| Retomada | Limitada | Total |

---

## 6. Detalhes Técnicos

### 6.1 Checkpoint Storage
```typescript
const STORAGE_KEY = 'djen-processos-checkpoint-v1';
// Expira após 24h
// Contém: runKey, grupoIdx, novas, duplicadas, tempoInicio
```

### 6.2 Metadata no Banco
Atualizado em `configuracoes_monitoramento` tipo `djen_processos`:
```json
{
  "status": "executando" | "concluido" | "cancelado" | "erro",
  "grupo_atual": 150,
  "total_grupos": 248,
  "percentage": 60,
  "novas": 12,
  "duplicadas": 45,
  "run_key": "2026-02-04..2026-02-04",
  "browser_execution": true,
  "estrategia": "singleton_engine_v1"
}
```

### 6.3 Circuit Breaker (mantido)
```typescript
const MAX_CONSECUTIVE_BLOCKS = 3;
// Se 3 grupos seguidos falharem por bloqueio → abortar
```

### 6.4 Delays (respeitando parâmetros do banco)
```typescript
delay_entre_lotes: 3000,      // 3s entre grupos
delay_entre_paginas: 1500,    // 1.5s entre páginas do mesmo grupo
max_retries: 4,               // tentativas por grupo
retry_base_delay_ms: 8000,    // backoff base
```

---

## 7. Ordem de Implementação

1. **Migração de dados (opcional):** Criar migration para adicionar coluna `excluir_djen_processos` em coordenações (para configuração via UI no futuro)

2. **Criar Engine Singleton:** `useDjenProcessosEngine.ts`
   - Copiar estrutura de `useDjenTermosEngine.ts`
   - Adaptar para grupos de processos
   - Adicionar filtro de coordenações

3. **Criar Hook React:** `useDjenProcessos.ts`
   - Wrapper fino sobre a engine

4. **Atualizar Card:** `MonitoramentoDjenProcessosCard.tsx`
   - Usar novo hook
   - Adicionar indicador visual de exclusões

5. **Testar:**
   - Executar busca para 1 dia
   - Verificar checkpoint ao sair/voltar
   - Testar retomada manual
   - Confirmar exclusão Santander

