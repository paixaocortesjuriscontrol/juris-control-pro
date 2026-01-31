
# Plano: Busca DJEN Termos Inteligente e Otimizada

## Problema Atual

O sistema executa **uma busca por monitoramento**, mesmo quando vários monitoramentos usam a mesma OAB/termo. Exemplo real:

| OAB | Coordenações | Monitoramentos | Buscas Atuais |
|-----|--------------|----------------|---------------|
| 10424 | 4 | 7 | 7 buscas duplicadas |
| 15553 | 3 | 7 | 7 buscas duplicadas |

**Resultado**: Buscas lentas, redundantes e mais propensas a Rate Limit (429).

---

## Solução: Busca Agrupada + Distribuição Inteligente

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  FASE 1: AGRUPAR ADVOGADOS POR OAB                                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  OAB 10424 → 1 ÚNICA BUSCA (todas UFs configuradas)               │ │
│  │  OAB 15553 → 1 ÚNICA BUSCA                                         │ │
│  │  OAB 25181 → 1 ÚNICA BUSCA                                         │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  FASE 2: DISTRIBUIR RESULTADOS POR COORDENAÇÃO                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Para cada publicação encontrada:                                  │ │
│  │  ├─ Santander Cível: aplica 81 exclusões → descarta ou aceita     │ │
│  │  ├─ Dr. Thomás: aplica 4 exclusões → descarta ou aceita           │ │
│  │  ├─ Dra. Janaína: aplica 1 exclusão → descarta ou aceita          │ │
│  │  └─ Santander Trabalhista: aplica 29 exclusões → descarta ou aceita│ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  RESULTADO: Publicação pode ir para 0, 1 ou N coordenações              │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Fluxo Hierárquico Otimizado

```text
Execução:
│
├─ 1. ADVOGADOS (agrupados por OAB)
│     ├─ OAB 10424: buscar UFs [DF, MT, RO, AC, MS...] → 47 publicações
│     │     ├─ Distribuir → Santander Cível: 12 aceitas, 35 excluídas
│     │     ├─ Distribuir → Dr. Thomás: 40 aceitas, 7 excluídas
│     │     ├─ Distribuir → Dra. Janaína: 45 aceitas, 2 excluídas
│     │     └─ Distribuir → Santander Trabalhista: 20 aceitas, 27 excluídas
│     │
│     ├─ OAB 15553: buscar UFs [DF, SP...] → 23 publicações
│     │     └─ (mesma lógica de distribuição)
│     │
│     └─ ... demais OABs
│
├─ 2. PALAVRAS-CHAVE (sem agrupamento - cada uma é única)
│     ├─ "UNIAO QUIMICA" → buscar → aplicar exclusões por coordenação
│     └─ ...
│
└─ 3. PROCESSOS (sem agrupamento - cada número é único)
      └─ ...
```

---

## Mudanças Técnicas

### 1. Nova Interface: Grupo de Advogados
```typescript
interface GrupoAdvogado {
  oab: string;
  ufsUnificadas: string[];  // Todas UFs de todos os monitoramentos
  nomeParaValidacao: string; // Nome mais completo para validar conteúdo
  monitoramentos: Array<{
    id: string;
    coordenacaoId: string;
    coordenacaoNome: string;
    exclusoes: string[];
    termoOriginal: string;
  }>;
}
```

### 2. Função: agruparAdvogadosPorOab()
Antes de iniciar a busca, agrupa todos monitoramentos de advogado pela OAB:
- Consolida UFs (remove duplicatas)
- Preserva exclusões específicas de cada monitoramento/coordenação

### 3. Função: buscarAdvogadoAgrupado()
Executa UMA busca por OAB, iterando pelas UFs consolidadas.

### 4. Função: distribuirParaCoordenacoes()
Para cada publicação retornada:
1. Valida OAB + nome no conteúdo (regra atual: 80% palavras)
2. Para cada monitoramento do grupo:
   - Verifica exclusões específicas da coordenação
   - Se passar, insere na `publicacoes_djen` vinculada ao monitoramento

### 5. Atualização do Loop Principal
O loop de advogados passa a iterar por **OABs agrupadas** em vez de monitoramentos individuais.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useBuscaDjenDireta.ts` | Nova lógica de agrupamento e distribuição para advogados |
| `src/types/djenProgress.ts` | Nova interface `GrupoAdvogado` |

---

## Benefícios

| Métrica | Antes | Depois |
|---------|-------|--------|
| Buscas para OAB 10424 | 7 | 1 |
| Buscas para OAB 15553 | 7 | 1 |
| Total de buscas (advogados) | 28 | ~7 (OABs únicas) |
| Risco de 429 | Alto | Reduzido 75% |
| Tempo estimado | ~15 min | ~4 min |

---

## Critérios de Sucesso

- [ ] Advogados com mesma OAB executam UMA busca na API
- [ ] Publicações são distribuídas corretamente por coordenação
- [ ] Exclusões são aplicadas POR COORDENAÇÃO (uma pub pode ser aceita em A e excluída em B)
- [ ] Estatísticas refletem novas/duplicadas/descartadas por coordenação
- [ ] UI mostra progresso por OAB (não por monitoramento individual)

---

## Detalhes de Implementação

### Passo 1: Criar estrutura de agrupamento
```typescript
const agruparAdvogadosPorOab = (advogados: MonitoramentoDjen[]): Map<string, GrupoAdvogado> => {
  const grupos = new Map<string, GrupoAdvogado>();
  
  for (const mon of advogados) {
    const oab = (mon.oab || '').replace(/\D/g, '');
    if (!oab) continue;
    
    if (!grupos.has(oab)) {
      grupos.set(oab, {
        oab,
        ufsUnificadas: [],
        nomeParaValidacao: mon.termo_busca,
        monitoramentos: [],
      });
    }
    
    const grupo = grupos.get(oab)!;
    
    // Adicionar UFs
    const ufs = (mon.uf || '').split(',').map(u => u.trim().toUpperCase()).filter(u => u.length === 2);
    ufs.forEach(uf => {
      if (!grupo.ufsUnificadas.includes(uf)) grupo.ufsUnificadas.push(uf);
    });
    
    // Escolher o nome mais completo para validação
    if (mon.termo_busca.length > grupo.nomeParaValidacao.length) {
      grupo.nomeParaValidacao = mon.termo_busca;
    }
    
    // Adicionar monitoramento
    grupo.monitoramentos.push({
      id: mon.id,
      coordenacaoId: mon.coordenacao_id || '',
      coordenacaoNome: '', // Preenchido depois
      exclusoes: mon.exclusoes || [],
      termoOriginal: mon.termo_busca,
    });
  }
  
  return grupos;
};
```

### Passo 2: Busca unificada por OAB
```typescript
const buscarAdvogadoAgrupado = async (grupo: GrupoAdvogado): Promise<PublicacaoResultado[]> => {
  // UMA busca com todas as UFs consolidadas
  // Retorna publicações brutas (sem filtro de exclusão ainda)
};
```

### Passo 3: Distribuição inteligente
```typescript
const distribuirParaCoordenacoes = async (
  publicacoes: PublicacaoResultado[],
  grupo: GrupoAdvogado
): Promise<{ novasPorCoordenacao: Map<string, number> }> => {
  for (const pub of publicacoes) {
    // Validar OAB + nome no conteúdo
    if (!conteudoContemAdvogado(pub.conteudo, grupo.oab, grupo.nomeParaValidacao)) {
      continue; // Descartar globalmente
    }
    
    // Para cada monitoramento/coordenação
    for (const mon of grupo.monitoramentos) {
      // Verificar exclusões DESTA coordenação
      const temExclusao = mon.exclusoes.some(exc => 
        pub.conteudo?.toUpperCase().includes(exc.toUpperCase())
      );
      
      if (!temExclusao) {
        // Inserir publicação vinculada a ESTE monitoramento
        await inserirPublicacao(pub, mon.id, mon.coordenacaoId);
      }
    }
  }
};
```

---

## Ordem de Implementação

1. Criar interface `GrupoAdvogado` em `src/types/djenProgress.ts`
2. Implementar `agruparAdvogadosPorOab()` no hook
3. Implementar `buscarAdvogadoAgrupado()` (adaptar `buscarMonitoramento`)
4. Implementar `distribuirParaCoordenacoes()` com lógica de exclusões por coordenação
5. Atualizar loop principal para usar nova estratégia
6. Atualizar UI de progresso para mostrar "OAB X/Y" em vez de "Monitoramento X/Y"
7. Testar com dados reais
