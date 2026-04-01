

## Análise: Por Que as Duplicatas Estão Elevadas no DJEN Termos Pro

### Causas Identificadas

**1. Contador de duplicatas inflado artificialmente (linha 1075)**

O cálculo atual é:
```text
duplicadas = duplicadasBanco 
           + (pubsValidas.length - pubsUnicas.length)   // dedup local por hash
           + (descartadas - descartadasEfetivas)         // ← PROBLEMA
```

O terceiro termo `(descartadas - descartadasEfetivas)` soma ao contador de duplicatas as publicações descartadas que eram duplicatas entre si. Isso **infla** o número porque itens descartados por motivos legítimos (tribunal errado, exclusão, etc.) que coincidentemente tinham hash igual são contados como "duplicatas" quando na verdade são "descartadas repetidas". Esse número deveria ser ignorado ou reportado separadamente.

**2. Múltiplas estratégias de busca retornam os mesmos itens com IDs diferentes**

O engine faz várias chamadas à API para o mesmo monitoramento:
- Busca primária (por OAB/nome/parte)
- Retry sem UF para tribunais superiores
- Buscas individuais para cada `termos_or`
- Busca complementar para tipo `parte`

A deduplicação no `addResults` (linhas 570-584) usa o `id` da API como chave. Porém, a mesma publicação pode ter IDs diferentes quando retornada por chamadas diferentes (ex: busca por nome vs busca por OAB). Esses itens passam o filtro `seen` mas são pegos depois pelo hash local → contam como duplicatas.

**3. Dedup no banco é por `monitoramento_id + hash_conteudo`**

Se o usuário roda a busca mais de uma vez no mesmo dia, TODAS as publicações já salvas voltam como "duplicadasBanco". Isso é comportamento correto mas faz o número parecer alto.

### Plano de Correção

**Arquivo**: `src/hooks/useDjenTermosProEngine.ts`

1. **Corrigir o cálculo de duplicatas (linha 1075)**: Remover o termo `(descartadas - descartadasEfetivas)` do contador de duplicatas. Publicações descartadas que são duplicatas entre si não devem inflar o contador de duplicadas — são simplesmente descartadas redundantes.

2. **Melhorar a deduplicação no `addResults` (linhas 570-584)**: Além de deduplicar por `id` da API, gerar um hash de conteúdo já no momento da coleta e usar como chave secundária. Isso evita que a mesma publicação entre no array `resultados` múltiplas vezes quando vem de chamadas diferentes com IDs distintos.

3. **Adicionar log separando os tipos de duplicata**: No log de resumo (linha 978), discriminar:
   - Duplicatas locais (hash): quantas foram deduplicadas dentro da mesma execução
   - Duplicatas banco: quantas já existiam no banco
   - Isso permite diagnosticar se o problema é excesso de chamadas à API ou re-execução

### Seção Técnica

```text
ANTES:
  addResults → dedup por item.id apenas
  duplicadas = banco + hashLocal + (descartadas - descEfetivas)  ← inflado

DEPOIS:
  addResults → dedup por item.id + fallback por hash de conteúdo
  duplicadas = banco + hashLocal  ← preciso
  log: "X dedup API-id, Y dedup hash-local, Z já no banco"
```

