

# Plano: Corrigir Deduplicação por Data de Disponibilização + Busca com/sem Acentos

## Problemas Identificados

### Problema 1: Deduplicação Incorreta
A publicação do TJDFT (processo `0705883-56.2026.8.07.0016`) foi disponibilizada duas vezes:

| Versão | Data Disponibilização | Data Publicação | Status |
|--------|----------------------|-----------------|--------|
| 1ª | 27/01/2026 | 28/01/2026 | Capturada |
| 2ª | 29/01/2026 | 30/01/2026 | Descartada como duplicata |

**Causa**: O hash global usa `data_publicacao` (linha 904), mas deveria usar `data_disponibilizacao` para tratar cada ato de disponibilização como distinto.

### Problema 2: Busca Sensível a Acentos
O termo "União Quimica Farmacêutica Nacional" não encontra publicações escritas como "UNIAO QUIMICA FARMACEUTICA NACIONAL" porque a API faz busca literal.

---

## Solução

### Parte 1: Alterar Hash Global para Usar Data de Disponibilização

**Arquivo**: `supabase/functions/monitorar-djen/index.ts`

**Mudança 1 - Função generateGlobalHash (linhas 596-599)**:
```typescript
// ANTES:
function generateGlobalHash(conteudo: string, dataPublicacao: string): string {
  const normalized = (conteudo + dataPublicacao).toLowerCase().replace(/\s+/g, ' ').trim();
  return generateHash(normalized);
}

// DEPOIS:
function generateGlobalHash(conteudo: string, dataDisponibilizacao: string): string {
  // Usar data de disponibilização para que republicações do mesmo conteúdo
  // em datas diferentes sejam tratadas como registros distintos
  const normalized = (conteudo + dataDisponibilizacao).toLowerCase().replace(/\s+/g, ' ').trim();
  return generateHash(normalized);
}
```

**Mudança 2 - Chamada do generateGlobalHash (linha 904)**:
```typescript
// ANTES:
const globalHash = generateGlobalHash(conteudo, dataPublicacao);

// DEPOIS:
const globalHash = generateGlobalHash(conteudo, dataDisponibilizacao);
```

**Mudança 3 - Hash do conteúdo (linha 841)**:
```typescript
// ANTES:
const hashConteudo = generateHash(conteudo + (pub.dataPublicacao || pub.dataDisponibilizacao || pub.data || ''));

// DEPOIS:
// Priorizar data_disponibilizacao para consistência com globalHash
const hashConteudo = generateHash(conteudo + (pub.dataDisponibilizacao || pub.dataPublicacao || pub.data || ''));
```

### Parte 2: Adicionar Variante de Busca Sem Acentos

**Arquivo**: `supabase/functions/monitorar-djen/index.ts`

**Mudança nas linhas 773-774** (tipo palavra-chave):
```typescript
// ANTES:
} else if (monitoramento.tipo === "palavra-chave") {
  searchCandidates.push({ texto: monitoramento.termo_busca });
}

// DEPOIS:
} else if (monitoramento.tipo === "palavra-chave") {
  const termo = monitoramento.termo_busca;
  searchCandidates.push({ texto: termo });
  
  // Adicionar variante sem acentos para melhor cobertura
  const termoSemAcento = termo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove acentos
    .replace(/[\/]/g, ' ')             // S/A -> S A
    .replace(/\s+/g, ' ')              // Normaliza espaços
    .trim();
  
  // Se a variante for diferente, adicionar como candidato adicional
  if (termoSemAcento.toLowerCase() !== termo.toLowerCase()) {
    searchCandidates.push({ texto: termoSemAcento });
    console.log(`[DJEN] Variante sem acento adicionada: "${termoSemAcento}"`);
  }
}
```

**Mudança similar nas linhas 777-783** (tipo parte):
```typescript
// ANTES:
} else if (monitoramento.tipo === "parte") {
  const termo = (monitoramento.termo_busca || "").trim();
  if (termo.length >= 3) {
    searchCandidates.push({ texto: termo });
    console.log(`Parte search: "${termo}"`);
  }
}

// DEPOIS:
} else if (monitoramento.tipo === "parte") {
  const termo = (monitoramento.termo_busca || "").trim();
  if (termo.length >= 3) {
    searchCandidates.push({ texto: termo });
    
    // Variante sem acentos
    const termoSemAcento = termo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (termoSemAcento.toLowerCase() !== termo.toLowerCase()) {
      searchCandidates.push({ texto: termoSemAcento });
      console.log(`[DJEN] Parte variante sem acento: "${termoSemAcento}"`);
    }
    
    console.log(`Parte search: "${termo}"`);
  }
}
```

### Parte 3: Alinhar Frontend (djenDedup.ts)

**Arquivo**: `src/utils/djenDedup.ts`

**Mudança nas linhas 37-44** (priorizar data_disponibilizacao):
```typescript
// ANTES:
// Cascata de datas: publicação > disponibilização > created_at
let dataPrimaria = extractDateKey(pub.data_publicacao);
if (dataPrimaria === "null") {
  dataPrimaria = extractDateKey(pub.data_disponibilizacao);
}
if (dataPrimaria === "null") {
  dataPrimaria = extractDateKey(pub.created_at);
}

// DEPOIS:
// Cascata de datas: disponibilização > publicação > created_at
// Prioriza data_disponibilizacao para alinhar com backend e tratar
// republicações como registros distintos
let dataPrimaria = extractDateKey(pub.data_disponibilizacao);
if (dataPrimaria === "null") {
  dataPrimaria = extractDateKey(pub.data_publicacao);
}
if (dataPrimaria === "null") {
  dataPrimaria = extractDateKey(pub.created_at);
}
```

---

## Seção Técnica

### Arquivos Modificados

| Arquivo | Linhas | Mudança |
|---------|--------|---------|
| `supabase/functions/monitorar-djen/index.ts` | 596-599 | Renomear parâmetro para `dataDisponibilizacao` |
| `supabase/functions/monitorar-djen/index.ts` | 841 | Priorizar `dataDisponibilizacao` no hashConteudo |
| `supabase/functions/monitorar-djen/index.ts` | 904 | Passar `dataDisponibilizacao` para `generateGlobalHash` |
| `supabase/functions/monitorar-djen/index.ts` | 773-783 | Adicionar variantes sem acento para palavra-chave e parte |
| `src/utils/djenDedup.ts` | 37-44 | Priorizar `data_disponibilizacao` na chave de dedup |

### Lógica de Normalização de Acentos
```text
"União Quimica Farmacêutica Nacional"
    ↓ normalize('NFD')
"União Quimica Farmacêutica Nacional" (decomposed)
    ↓ replace(/[\u0300-\u036f]/g, '')
"Uniao Quimica Farmaceutica Nacional"
```

### Impacto Esperado

1. **Deduplicação**: Publicações republicadas pelo tribunal em datas de disponibilização diferentes serão capturadas como registros distintos
2. **Busca**: Termos com acentos também buscarão a variante sem acentos, aumentando a cobertura
3. **Compatibilidade**: Nenhum impacto negativo em publicações existentes

### Ação Pós-Implementação
Após deploy da edge function, executar novamente o monitoramento DJEN para capturar as publicações que foram erroneamente descartadas.

---

## ✅ IMPLEMENTADO EM 30/01/2026

Todas as alterações foram aplicadas com sucesso:
- `generateGlobalHash` agora usa `dataDisponibilizacao`
- `hashConteudo` prioriza `dataDisponibilizacao`
- Busca inclui variantes sem acentos automaticamente
- Frontend `djenDedup.ts` alinhado com backend

