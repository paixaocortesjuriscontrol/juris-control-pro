
# Plano: Corrigir Travamento e Cancelamento do Monitoramento DJEN

## Diagnóstico do Problema

### Situação Atual
1. **Execução travada no banco**: A execução `247bd5c0-3a5a-491c-bdb7-320f9eb9e6c7` (tipo "djen") está com:
   - `status: executando` 
   - `finalizado_em: null` (não finalizado)
   - `registros_processados: 0` (30 de 118 no `detalhes`)
   - Iniciada às 09:07:29 - há mais de 12 minutos sem progresso

2. **Cancelamento não funciona**: O botão "Cancelar" no frontend usa `cancelarRef.current = true`, que **só funciona se o loop de execução estiver ativo** (`localRunActive`). Se o loop travou/morreu por erro, não há nada verificando essa flag.

3. **UI mostra 31% travado**: O frontend exibe o progresso da última atualização do registro, mas como a execução está "morta" sem ter sido finalizada, fica preso visualmente.

### Causa Raiz
Diferente do `monitorar-andamentos` que acabamos de implementar timeout inteligente + heartbeat, o **monitoramento DJEN (useBuscaDjenDireta)** roda no frontend e não tem:
- Timeout automático para liberar execuções travadas
- Mecanismo de "force cancel" quando o loop não está ativo
- Limpeza de execuções órfãs no banco

---

## Solução Proposta

### Parte 1: Limpeza Imediata de Execução Travada
Adicionar um botão "Forçar Cancelamento" que atualiza diretamente o banco quando o loop não está ativo.

**Arquivo**: `src/components/configuracoes/DjenTermosDashboardCard.tsx`

```typescript
// Detectar se a execução está "órfã" (rodando no banco mas não no frontend)
const execucaoOrfa = isRunning && !localRunActive;

// Função para forçar cancelamento direto no banco
const handleForceCancelar = async () => {
  try {
    // Buscar execução em andamento deste tipo
    const { data: execucao } = await supabase
      .from('execucoes_agendadas')
      .select('id')
      .eq('tipo', 'djen')
      .eq('status', 'executando')
      .is('finalizado_em', null)
      .order('iniciado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (execucao) {
      await supabase
        .from('execucoes_agendadas')
        .update({
          status: 'cancelado',
          finalizado_em: new Date().toISOString(),
          detalhes: { cancelled: true, reason: 'force_cancel_orphan' },
        })
        .eq('id', execucao.id);
    }

    // Limpar metadata da config também
    await supabase
      .from('configuracoes_monitoramento')
      .update({
        metadata: {
          status: 'cancelado',
          cancelado: true,
          continuingRun: false,
        },
      })
      .eq('tipo', 'djen')
      .is('coordenacao_id', null);

    toast.success('Execução cancelada forçadamente');
    onAfterMutation();
  } catch (e: any) {
    toast.error(`Erro ao forçar cancelamento: ${e?.message}`);
  }
};
```

---

### Parte 2: UI para Exibir Botão Correto
Mostrar "Forçar Cancelamento" quando a execução está órfã (rodando no banco mas não no frontend).

**Arquivo**: `src/components/configuracoes/DjenTermosDashboardCard.tsx`

```typescript
// Substituir lógica do botão cancelar
{canCancel && (
  <Button variant="destructive" size="sm" onClick={handleCancelar}>
    <StopCircle className="h-4 w-4 mr-2" />
    Cancelar
  </Button>
)}

{/* NOVO: Botão para forçar cancelamento de execução órfã */}
{execucaoOrfa && (
  <Button 
    variant="destructive" 
    size="sm" 
    onClick={handleForceCancelar}
    className="gap-2"
  >
    <XCircle className="h-4 w-4" />
    Forçar Cancelamento
  </Button>
)}
```

---

### Parte 3: Auto-Limpeza de Execuções Órfãs (Preventivo)
Adicionar lógica no `useEffect` do card para detectar e limpar execuções órfãs automaticamente.

**Arquivo**: `src/components/configuracoes/DjenTermosDashboardCard.tsx`

```typescript
// No início do componente, verificar e limpar execuções órfãs
useEffect(() => {
  const limparExecucoesOrfas = async () => {
    // Se não há execução local ativa, verificar banco por execuções travadas
    if (!localRunActive) {
      const dezMinutosAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      
      const { data: orfas } = await supabase
        .from('execucoes_agendadas')
        .select('id, iniciado_em')
        .eq('tipo', 'djen')
        .eq('status', 'executando')
        .is('finalizado_em', null)
        .lt('iniciado_em', dezMinutosAtras)
        .limit(5);

      if (orfas && orfas.length > 0) {
        console.log(`[DJEN] Detectadas ${orfas.length} execuções órfãs, limpando...`);
        
        for (const orfa of orfas) {
          await supabase
            .from('execucoes_agendadas')
            .update({
              status: 'timeout',
              finalizado_em: new Date().toISOString(),
              ultimo_erro: 'Execução órfã detectada e limpa automaticamente',
            })
            .eq('id', orfa.id);
        }
        
        onAfterMutation();
      }
    }
  };

  limparExecucoesOrfas();
}, [localRunActive, stats.status]);
```

---

### Parte 4: Refatorar Hook para Finalização Robusta
Garantir que o hook `useBuscaDjenDireta` sempre finalize a execução no banco, mesmo em caso de erro.

**Arquivo**: `src/hooks/useBuscaDjenDireta.ts`

Na função `executarMonitoramento`, adicionar try/finally para garantir finalização:

```typescript
const executarMonitoramento = useCallback(async (...) => {
  let executionId: string | null = null;
  
  try {
    executionId = await registrarExecucao('executando', { ... });
    // ... lógica principal ...
  } catch (error) {
    console.error('[DJEN] Erro na execução:', error);
    
    // GARANTIR que sempre finalize no banco
    if (executionId) {
      await supabase
        .from('execucoes_agendadas')
        .update({
          status: 'erro',
          finalizado_em: new Date().toISOString(),
          detalhes: { error: error.message },
        })
        .eq('id', executionId);
    }
    
    throw error;
  } finally {
    setExecutando(false);
  }
}, [...]);
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/configuracoes/DjenTermosDashboardCard.tsx` | Adicionar botão "Forçar Cancelamento" para execuções órfãs + auto-limpeza |
| `src/hooks/useBuscaDjenDireta.ts` | Garantir finalização robusta com try/finally |

---

## Comportamento Esperado Após Implementação

| Cenário | Antes | Depois |
|---------|-------|--------|
| Execução travada sem loop ativo | UI mostra "executando" sem botão útil | Botão "Forçar Cancelamento" aparece |
| Execução órfã há mais de 10min | Fica travada indefinidamente | Auto-limpa ao abrir o card |
| Erro durante execução | Execução fica "executando" no banco | Sempre finaliza como "erro" |
| Cancelamento normal (loop ativo) | Funciona | Continua funcionando igual |

---

## Benefício Imediato
Após implementar, o usuário poderá:
1. Clicar em "Forçar Cancelamento" para liberar a execução travada
2. Iniciar uma nova execução normalmente
3. Não ter mais execuções órfãs bloqueando o sistema
