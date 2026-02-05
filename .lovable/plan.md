
# Plano: Corrigir Cache Compartilhado que Impede Captura de Publicações

## Problema Identificado

A publicação do processo **0737746-12.2025.8.07.0001** (TJDFT, 04/02/2026) contendo "OSMAR MENDES PAIXAO CORTES - OAB DF-15553" **não foi capturada** pelo monitoramento configurado para tribunais TJDFT, TRF1 e STJ.

### Causa Raiz

O **cache compartilhado de advogados** (`sharedAdvogadoCache`) usa uma chave que **não inclui o tribunal**:

```typescript
const cacheKey = `${baseParams.dataInicio}|${baseParams.oab}|${uf ?? 'ALL'}`
// Ex: "2026-02-04|15553|DF"
```

Isso causa o seguinte problema:

1. Sistema busca para **TJDFT** (OAB 15553 / UF DF) → API retorna X publicações
2. Resultado é salvo no cache com chave `"2026-02-04|15553|DF"`
3. Sistema vai buscar para **STJ** (OAB 15553 / UF DF) → **usa o cache do TJDFT!**
4. Sistema vai buscar para **TRF1** (OAB 15553 / UF DF) → **usa o mesmo cache!**

**O cache foi projetado para evitar requisições duplicadas quando NÃO se filtra por tribunal**, mas quando `advogadoForcarTribunalNaBusca = true` (3 ou menos tribunais), cada tribunal deveria ter sua própria requisição separada.

### Por que a publicação não apareceu

Se a primeira requisição (ex: TJDFT) falhou silenciosamente, retornou vazio, ou a API não incluiu essa publicação específica, o cache salva esse resultado vazio. As requisições subsequentes para STJ e TRF1 usam esse cache vazio, perdendo a chance de capturar a publicação que estava disponível no TJDFT.

## Solução Proposta

### Mudança 1: Incluir Tribunal na Chave do Cache

Quando `advogadoForcarTribunalNaBusca = true`, a chave do cache DEVE incluir o tribunal:

```typescript
const cacheKey = isAdvogadoComOab
  ? `${baseParams.dataInicio}|${baseParams.oab}|${uf ?? 'ALL'}|${advogadoForcarTribunalNaBusca ? trib ?? 'ALL' : 'ALL'}`
  : null;
```

Isso garante que cada tribunal tenha seu próprio cache, evitando interferência entre buscas.

### Mudança 2: Não Usar Cache Quando Filtrando por Tribunal

Alternativa mais segura: simplesmente **desabilitar o cache** quando `advogadoForcarTribunalNaBusca = true`, pois nesse cenário temos poucas requisições (≤3 tribunais):

```typescript
const cacheKey = isAdvogadoComOab && !advogadoForcarTribunalNaBusca
  ? `${baseParams.dataInicio}|${baseParams.oab}|${uf ?? 'ALL'}`
  : null; // Não cachear quando buscando por tribunal específico
```

## Detalhes Técnicos

### Arquivo a Modificar

`src/hooks/useDjenTermosEngine.ts`

### Localização

Linhas 752-754:

```typescript
const cacheKey = isAdvogadoComOab
  ? `${baseParams.dataInicio}|${baseParams.oab}|${uf ?? 'ALL'}`
  : null;
```

### Nova Lógica

```typescript
// Quando advogadoForcarTribunalNaBusca = true, cada tribunal tem seu próprio cache
// porque a API retorna resultados diferentes para cada siglaTribunal.
// Sem esse fix, o cache do 1º tribunal é reutilizado para os demais, perdendo publicações.
const cacheKey = isAdvogadoComOab
  ? `${baseParams.dataInicio}|${baseParams.oab}|${uf ?? 'ALL'}${advogadoForcarTribunalNaBusca ? `|${trib ?? 'ALL'}` : ''}`
  : null;
```

## Impacto

- **Positivo**: Publicações de advogados para tribunais específicos (TJDFT, STJ, TRF1) serão corretamente buscadas e capturadas
- **Performance**: Ligeiro aumento no número de requisições quando há poucos tribunais configurados (máximo 3 requisições adicionais por termo), mas isso já era o comportamento esperado
- **Backward Compatible**: Não afeta monitoramentos sem filtro de tribunal (continuam usando cache compartilhado)

## Validação

Após a correção, executar o monitoramento DJEN para o dia 04/02/2026 e verificar se a publicação do processo 0737746-12.2025.8.07.0001 é capturada pelo monitoramento "DJEN do TJDFT, TRF1 e STJ".
