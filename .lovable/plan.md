
# Plano: Reestruturar Monitoramento DJEN por Coordenação e Tipo de Termo

## Problema Atual

O loop de monitoramento DJEN atual processa **todos os monitoramentos de forma sequencial misturada**, sem organização por coordenação ou tipo. Isso dificulta:
1. Identificar onde o processamento está (qual coordenação, qual tipo de termo)
2. Rastrear problemas específicos de uma coordenação
3. Saber se advogados, palavras-chave ou processos já foram processados
4. Apresentar progresso granular ao usuário

## Solução Proposta

Reestruturar o loop de execução em **3 níveis hierárquicos**:

```
┌─────────────────────────────────────────────────────────────────┐
│  NÍVEL 1: COORDENAÇÃO                                          │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  NÍVEL 2: TIPO DE TERMO                                   │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  NÍVEL 3: MONITORAMENTOS                            │  │ │
│  │  │  - Processa cada termo individual                   │  │ │
│  │  │  - Busca em todos os tribunais configurados         │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                           │ │
│  │  Sequência por tipo:                                     │ │
│  │  1. Advogados (busca por OAB/UF)                         │ │
│  │  2. Palavras-chave (busca por termo/parte)               │ │
│  │  3. Processos (busca por número CNJ)                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  Exemplo de execução:                                          │
│  → Coordenação: Santander Cível                               │
│     → Advogados: 2/2 concluídos                               │
│     → Palavras-chave: 5/12 (executando)                       │
│     → Processos: 0/0 (pendente)                               │
│  → Coordenação: Dr. Thomás                                     │
│     → (aguardando)                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mudanças Técnicas

### 1. Novo Modelo de Progresso (src/hooks/useBuscaDjenDireta.ts)

Adicionar estrutura detalhada para rastrear cada fase:

```typescript
export interface ProgressoPorCoordenacao {
  coordenacaoId: string;
  coordenacaoNome: string;
  status: 'pendente' | 'executando' | 'concluido' | 'erro';
  
  // Progresso por tipo de termo
  advogados: {
    total: number;
    processados: number;
    status: FaseStatus;
  };
  palavrasChave: {
    total: number;
    processados: number;
    status: FaseStatus;
  };
  processos: {
    total: number;
    processados: number;
    status: FaseStatus;
  };
  
  // Estatísticas
  novas: number;
  duplicadas: number;
}

export interface ProgressoExecucaoV2 extends ProgressoExecucao {
  // Novo: progresso detalhado por coordenação
  coordenacoes: ProgressoPorCoordenacao[];
  coordenacaoAtual?: string;
  tipoAtual?: 'advogado' | 'palavra-chave' | 'processo';
}
```

### 2. Reestruturar Loop Principal (src/hooks/useBuscaDjenDireta.ts)

O loop atual (linhas 996-1151) será refatorado para:

```
ANTES:
for (monitoramentos) {
  processar(monitoramento)
}

DEPOIS:
for (coordenacao of coordenacoes) {
  atualizar_status(coordenacao, 'executando')
  
  // 1. Advogados
  advogados = filtrar_por_tipo(coordenacao, 'advogado')
  for (adv of advogados) {
    processar(adv)
    atualizar_progresso_tipo('advogados')
  }
  
  // 2. Palavras-chave
  termos = filtrar_por_tipo(coordenacao, ['palavra-chave', 'parte'])
  for (termo of termos) {
    processar(termo)
    atualizar_progresso_tipo('palavrasChave')
  }
  
  // 3. Processos
  processos = filtrar_por_tipo(coordenacao, 'processo')
  for (proc of processos) {
    processar(proc)
    atualizar_progresso_tipo('processos')
  }
  
  atualizar_status(coordenacao, 'concluido')
}
```

### 3. Novo Componente de Visualização

Criar `src/components/djen/ProgressoDjenDetalhado.tsx`:

- Exibir lista de coordenações com status (ícones: pendente, executando, concluído)
- Para coordenação em execução, mostrar barra de progresso por tipo de termo
- Indicador visual: qual advogado/termo está sendo processado no momento
- Contador de novas/duplicadas por coordenação

### 4. Atualizar MonitoramentoDjenCard.tsx

Integrar o novo componente de progresso no card existente, substituindo a barra de progresso simples atual (linhas 561-613) por uma visualização detalhada.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useBuscaDjenDireta.ts` | Reestruturar loop por coordenação e tipo; adicionar interfaces de progresso |
| `src/components/djen/ProgressoDjenDetalhado.tsx` | **NOVO** - Componente de visualização detalhada |
| `src/components/configuracoes/MonitoramentoDjenCard.tsx` | Integrar novo componente de progresso |

---

## Lógica de Agrupamento

```typescript
// Agrupar monitoramentos por coordenação e tipo
const agruparPorCoordenacaoETipo = (monitoramentos: MonitoramentoDjen[]) => {
  const grupos = new Map<string, {
    coordenacao: { id: string; nome: string };
    advogados: MonitoramentoDjen[];
    palavrasChave: MonitoramentoDjen[];
    processos: MonitoramentoDjen[];
  }>();
  
  for (const mon of monitoramentos) {
    const coordId = mon.coordenacao_id || '__sem_coordenacao__';
    
    if (!grupos.has(coordId)) {
      grupos.set(coordId, {
        coordenacao: { id: coordId, nome: '' }, // nome será preenchido depois
        advogados: [],
        palavrasChave: [],
        processos: [],
      });
    }
    
    const grupo = grupos.get(coordId)!;
    
    switch (mon.tipo) {
      case 'advogado':
        grupo.advogados.push(mon);
        break;
      case 'palavra-chave':
      case 'parte':
        grupo.palavrasChave.push(mon);
        break;
      case 'processo':
        grupo.processos.push(mon);
        break;
    }
  }
  
  return grupos;
};
```

---

## Interface Visual Proposta

### Durante Execução:

```
┌─────────────────────────────────────────────────────────────┐
│  Monitoramento DJEN - Em Execução                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✓ Santander Cível                     12 novas, 45 dup.   │
│    ✓ Advogados: 2/2                                         │
│    ✓ Palavras-chave: 15/15                                  │
│    ✓ Processos: 0/0                                         │
│                                                             │
│  ⟳ Dr. Thomás (Executando)             3 novas, 8 dup.     │
│    ✓ Advogados: 1/1                                         │
│    ⟳ Palavras-chave: 2/5 "UNIAO QUIMICA..."                │
│    ○ Processos: 0/3                                         │
│                                                             │
│  ○ Dra. Janaína (Aguardando)                                │
│  ○ Polyana (Aguardando)                                     │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 35%                          │
│  Tempo: 02:34  |  Total: 15 novas, 53 duplicadas            │
│                                                             │
│  [Cancelar Execução]                                        │
└─────────────────────────────────────────────────────────────┘
```

### Após Conclusão:

```
┌─────────────────────────────────────────────────────────────┐
│  Monitoramento DJEN - Concluído em 05:23                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ▼ Santander Cível                     12 novas ↓          │
│    Advogados: 2 | Termos: 15 | Processos: 0                │
│                                                             │
│  ▼ Dr. Thomás                          8 novas ↓           │
│    Advogados: 1 | Termos: 5 | Processos: 3                 │
│                                                             │
│  ▼ Dra. Janaína                        3 novas ↓           │
│    Advogados: 0 | Termos: 22 | Processos: 0                │
│                                                             │
│  Total: 23 novas publicações encontradas                   │
│                                                             │
│  [Executar Novamente]  [Limpar Dados de Hoje]              │
└─────────────────────────────────────────────────────────────┘
```

---

## Benefícios

1. **Visibilidade**: Saber exatamente qual coordenação e tipo está sendo processado
2. **Diagnóstico**: Se uma coordenação falhar, as outras continuam
3. **Priorização**: Advogados primeiro (menor volume), depois termos (maior cobertura), depois processos
4. **Rastreabilidade**: Estatísticas por coordenação facilitam identificar problemas
5. **UX Melhorada**: Usuário entende exatamente o que está acontecendo

---

## Ordem de Implementação

1. Criar interfaces de progresso detalhado
2. Implementar função de agrupamento por coordenação/tipo
3. Refatorar loop principal para processar hierarquicamente
4. Criar componente `ProgressoDjenDetalhado.tsx`
5. Integrar no `MonitoramentoDjenCard.tsx`
6. Testar com dados reais

---

## Critérios de Sucesso

- [ ] Executar monitoramento mostra progresso por coordenação
- [ ] Cada coordenação exibe status dos 3 tipos (advogados, termos, processos)
- [ ] Mensagem indica qual termo está sendo processado no momento
- [ ] Estatísticas (novas/duplicadas) são contabilizadas por coordenação
- [ ] Cancelamento salva checkpoint corretamente por coordenação/tipo
