

# Plano: Reverter para Modelo Original Simplificado

## Análise do Problema

A versão atual do `useBuscaDjenDireta.ts` está com complexidade excessiva:
- Separação por coordenações (loop aninhado)
- Separação por tipos (advogados → palavras-chave → processos)
- Fase 1A agrupada por OAB
- Fase 1B por coordenação
- Progresso complexo com múltiplas dimensões

A versão original (similar ao `useSincronizarDjenBrowser.ts`) era muito mais simples:
- **Lista única de monitoramentos ativos**
- **Loop sequencial simples**: `for i = 0 to total`
- **Progresso direto**: `current / total`
- Sem separação por coordenação no processamento

---

## Modelo Original a Restaurar

```text
┌─────────────────────────────────────────────────────────────────┐
│  BUSCAR todos monitoramentos ativos                             │
│  Total = N monitoramentos                                       │
│                                                                 │
│  for i = 0 to N:                                                │
│    ├─ Atualizar progresso: i / N                                │
│    ├─ Buscar publicações para monitoramento[i]                  │
│    ├─ Validar conteúdo (OAB+Nome para advogado, termo para KC)  │
│    ├─ Aplicar exclusões do PRÓPRIO monitoramento               │
│    └─ Inserir novas publicações                                 │
│                                                                 │
│  FIM: Mostrar totais                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Diferenças Chave

| Aspecto | Versão Atual (Complexa) | Versão Original (Simples) |
|---------|------------------------|---------------------------|
| Loop principal | Por coordenação → por tipo | Por monitoramento direto |
| Progresso | Matriz coordenações × tipos | Simples: i / total |
| Exclusões | Por coordenação (distribuição) | Por monitoramento individual |
| Agrupamento OAB | Sim (Fase 1A) | Não |

---

## Mudanças Técnicas

### 1. Simplificar `executarMonitoramento`

Remover toda a lógica de agrupamento por coordenação e tipo. Restaurar loop simples:

```typescript
// Buscar monitoramentos ativos
const { data: monitoramentos } = await supabase
  .from('monitoramentos_djen')
  .select('*')
  .eq('ativo', true);

const total = monitoramentos.length;

// Loop simples por monitoramento
for (let i = 0; i < total; i++) {
  if (cancelarRef.current) break;
  
  const mon = monitoramentos[i];
  
  // Atualizar progresso
  setProgresso(prev => ({
    ...prev,
    monitoramentoAtual: i + 1,
    totalMonitoramentos: total,
    termoAtual: mon.termo_busca,
  }));
  
  // Processar monitoramento
  const resultado = await processarMonitoramento(mon);
  
  // Acumular estatísticas
  totalNovas += resultado.novas;
  totalDuplicadas += resultado.duplicadas;
  totalDescartadas += resultado.descartadas;
}
```

### 2. Manter `processarMonitoramento` Existente

A função que processa um monitoramento individual permanece igual, pois já funciona corretamente:
- Busca publicações via API
- Valida conteúdo (OAB+Nome para advogado)
- Aplica exclusões do próprio monitoramento
- Insere novas publicações

### 3. Simplificar Interface de Progresso

Manter apenas campos essenciais:

```typescript
interface ProgressoExecucao {
  monitoramentoAtual: number;
  totalMonitoramentos: number;
  publicacoesNovas: number;
  publicacoesDuplicadas: number;
  publicacoesDescartadas: number;
  status: 'idle' | 'executando' | 'concluido' | 'erro' | 'cancelado';
  mensagem: string;
  termoAtual?: string;
  tempoDecorrido: number;
}
```

### 4. Remover Código Não Utilizado

- Remover funções de agrupamento por OAB
- Remover lógica de fases 1A/1B
- Remover estrutura `coordenacoes` do progresso
- Manter validação OAB+Nome corrigida

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useBuscaDjenDireta.ts` | Simplificar para modelo original |
| `src/types/djenProgress.ts` | Remover interfaces não utilizadas |
| `src/constants/version.ts` | Atualizar para 1.0.3 |
| `src/components/djen/ProgressoDjenDetalhado.tsx` | Simplificar UI (opcional) |

---

## Benefícios

- Código mais simples e manutenível
- Progresso funciona corretamente (i/total)
- Comportamento previsível e testado
- Validação OAB+Nome mantida da correção anterior

---

## Seção Técnica

### Estrutura Simplificada do Hook

```typescript
export function useBuscaDjenDireta() {
  // Estados básicos
  const [progresso, setProgresso] = useState<ProgressoExecucao>(INITIAL_STATE);
  const [isExecutando, setIsExecutando] = useState(false);
  const cancelarRef = useRef(false);

  const executarMonitoramento = useCallback(async () => {
    setIsExecutando(true);
    cancelarRef.current = false;
    
    // 1. Buscar monitoramentos
    const { data: monitoramentos } = await supabase
      .from('monitoramentos_djen')
      .select('*')
      .eq('ativo', true);
    
    const total = monitoramentos?.length || 0;
    let novas = 0, duplicadas = 0, descartadas = 0;
    
    // 2. Loop simples
    for (let i = 0; i < total; i++) {
      if (cancelarRef.current) break;
      
      const mon = monitoramentos[i];
      
      setProgresso(prev => ({
        ...prev,
        monitoramentoAtual: i + 1,
        totalMonitoramentos: total,
        termoAtual: mon.termo_busca,
      }));
      
      const result = await processarMonitoramento(mon);
      novas += result.novas;
      duplicadas += result.duplicadas;
      descartadas += result.descartadas;
      
      setProgresso(prev => ({
        ...prev,
        publicacoesNovas: novas,
        publicacoesDuplicadas: duplicadas,
        publicacoesDescartadas: descartadas,
      }));
    }
    
    // 3. Finalizar
    setProgresso(prev => ({
      ...prev,
      status: cancelarRef.current ? 'cancelado' : 'concluido',
    }));
    setIsExecutando(false);
  }, []);

  return { executarMonitoramento, progresso, isExecutando, cancelar };
}
```

