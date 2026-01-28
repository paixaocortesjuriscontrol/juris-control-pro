
# Plano de Otimização: Eliminar ERR_INSUFFICIENT_RESOURCES

## Diagnóstico do Problema

A página `ProcessoDetalhes` está causando **sobrecarga de recursos** porque:

1. **12+ queries simultâneas** ao Supabase são disparadas no momento do carregamento
2. **Todas as queries são ativadas** independentemente de qual aba está selecionada
3. **Badges de contagem** forçam o carregamento de todos os dados apenas para exibir números
4. **Query duplicada**: `redistribuicoes` consulta a mesma tabela `movimentacoes` com filtro diferente

### Queries Atuais (todas disparam ao mesmo tempo):
| Query | Tabela | Condição Atual |
|-------|--------|----------------|
| processo | processos | `enabled: !!id` |
| audiencias | audiencias_detectadas | `enabled: !!id && !!processo?.numero` |
| intimacoes | intimacoes_detectadas | `enabled: !!id && !!processo?.numero` |
| tarefas | tarefas | `enabled: !!id` |
| documentos | documentos | `enabled: !!id` |
| publicacoesDjen | publicacoes_djen_processos | `enabled: !!id` |
| movimentacoes | movimentacoes | `enabled: !!id` |
| redistribuicoes | movimentacoes (filtrado) | `enabled: !!id` |
| alertas360 | alertas_monitoramento | `enabled: !!id` |
| eventosAgenda | eventos_agenda | `enabled: !!id` |
| coordenacoes | coordenacoes | sempre ativo |
| clientes | clientes | sempre ativo |
| responsaveisProcesso | processos_responsaveis | `enabled: !!id` |

---

## Solucao Proposta: Lazy Loading por Aba

### Estrategia

1. **Queries essenciais** (carregam sempre): `processo`, `coordenacoes`, `clientes`, `responsaveisProcesso`
2. **Queries sob demanda** (carregam apenas quando a aba e aberta): audiencias, intimacoes, tarefas, documentos, publicacoes, movimentacoes, alertas360
3. **Eliminar query duplicada**: `redistribuicoes` sera derivada de `movimentacoes` via `.filter()` local
4. **Remover badges de contagem** ate que a aba seja visitada (exibir "-" ou icone de loading)

### Mudancas Tecnicas

#### 1. Adicionar condicao `activeTab` nas queries

```tsx
// Antes
const { data: audiencias = [] } = useQuery({
  queryKey: ["audiencias-processo", id],
  queryFn: async () => { ... },
  enabled: !!id && !!processo?.numero,
});

// Depois
const { data: audiencias = [] } = useQuery({
  queryKey: ["audiencias-processo", id],
  queryFn: async () => { ... },
  enabled: !!id && !!processo?.numero && activeTab === "audiencias",
});
```

#### 2. Derivar redistribuicoes localmente

```tsx
// Remover query separada de redistribuicoes
// Derivar do resultado de movimentacoes quando a aba for aberta
const redistribuicoes = movimentacoes.filter(m => 
  m.descricao?.toLowerCase().includes("redistribui")
);
```

#### 3. Simplificar badges (opcional)

Em vez de mostrar o numero exato, mostrar:
- Icone sem numero ate a aba ser visitada
- Ou usar uma query leve de COUNT apenas

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/ProcessoDetalhes.tsx` | Adicionar `activeTab` como condicao nas queries; remover query de redistribuicoes; ajustar badges |

---

## Resumo Tecnico

- **Causa Raiz**: Muitas queries Supabase simultaneas (12+) esgotam o limite de conexoes do navegador
- **Solucao**: Lazy loading - carregar dados apenas quando a aba correspondente for aberta
- **Impacto**: Reducao de 12+ queries para 3-4 no carregamento inicial
- **Risco**: Nenhum - os dados continuam disponiveis, apenas carregam sob demanda
