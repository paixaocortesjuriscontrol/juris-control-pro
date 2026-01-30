

# Plano: Solução Definitiva para Captura DJEN por Termos

## Problema Identificado

Com base na investigação detalhada do banco de dados e código, encontrei **dois problemas centrais** que estão causando a perda de publicações:

### Problema 1: Monitoramento Processando Poucos Tribunais

A última execução mostra:
```
processados: 3 de 118 monitoramentos
tribunais_stats: [TJSP, TRT10] apenas
novas: 0
```

**Causa**: O parâmetro `max_por_invocacao: 5` combinado com 118 monitoramentos significa que cada execução só processa ~5 monitoramentos. Com 35+ tribunais configurados no monitoramento "União Química", o sistema está levando múltiplas invocações para cobrir todos os tribunais, e o loop está sendo interrompido antes de processar TJRJ, TJRS, TJDFT, TJBA.

### Problema 2: Termo de Busca Não Encontra Todas as Variações

O monitoramento está configurado com:
```
termo_busca: "União Quimica Farmacêutica Nacional"
```

Mas as publicações no DJEN estão escritas como:
- `UNIAO QUIMICA FARMACEUTICA NACIONAL S A` (sem acentos, com "S A")
- `UNIÃO QUÍMICA FARMACÊUTICA NACIONAL S/A` (com acentos, com "S/A")
- `União Química Farmacêutica Nacional S.A.` (misto)

A normalização de acentos já existe (linhas 779-791), mas:
1. A variante **não inclui sufixos corporativos** ("S A", "S/A", "LTDA")
2. O loop de tribunais **pode ser interrompido por timeout** antes de processar todos

---

## Solução Proposta

### Parte 1: Aumentar Cobertura de Tribunais por Execução

**Arquivo**: `supabase/functions/monitorar-djen/index.ts`

Alterar a lógica para processar TODOS os tribunais de cada monitoramento antes de pular para o próximo, em vez de processar N monitoramentos por invocação:

1. Mudar o loop para processar cada monitoramento completamente (todos seus tribunais)
2. Usar soft-timeout para garantir que pelo menos 1 monitoramento seja processado por completo
3. Salvar progresso por monitoramento, não por lote genérico

### Parte 2: Melhorar Geração de Variantes de Busca

**Arquivo**: `supabase/functions/monitorar-djen/index.ts` (linhas 775-814)

Adicionar mais variantes de busca para termos empresariais:

```text
Termo original: "União Quimica Farmacêutica Nacional"
Variantes geradas:
1. "União Quimica Farmacêutica Nacional" (original)
2. "UNIAO QUIMICA FARMACEUTICA NACIONAL" (sem acentos)
3. "UNIAO QUIMICA" (prefixo curto - para capturar variações)
```

A variante de prefixo curto é importante porque:
- A API do PJE Comunica usa busca por substring
- "UNIAO QUIMICA" encontra tanto "UNIAO QUIMICA FARMACEUTICA NACIONAL S A" quanto "UNIÃO QUÍMICA FARMACÊUTICA NACIONAL S/A"

### Parte 3: Sincronização Manual via Navegador

**Arquivos novos**:
- `src/hooks/useSincronizarDjenBrowser.ts`
- `src/components/djen/BotaoSincronizarDjen.tsx`

**Arquivo modificado**:
- `src/pages/MonitoramentoDjen.tsx` ou `src/pages/AnaliseDjen.tsx`

Adicionar um botão "Sincronizar Agora" que:
1. Busca os monitoramentos ativos do usuário
2. Para cada monitoramento, executa busca via navegador (usando `pjeComunicaClient.ts`)
3. Insere as publicações encontradas diretamente no banco
4. Mostra progresso em tempo real

**Vantagens**:
- Contorna bloqueios de IP do backend
- Permite ao usuário forçar captura quando necessário
- Não depende de cron jobs ou Edge Functions

---

## Arquivos a Modificar/Criar

### 1. `supabase/functions/monitorar-djen/index.ts`

**Linha 775-814** - Melhorar geração de variantes:
- Adicionar lógica para extrair prefixo significativo do termo (primeiras 2-3 palavras)
- Garantir que variantes sem acento sejam sempre geradas

**Linhas 827-877** - Garantir processamento de todos tribunais:
- Remover break condicional que pode interromper antes de processar todos os tribunais
- Adicionar log detalhado por tribunal processado

### 2. `src/hooks/useSincronizarDjenBrowser.ts` (NOVO)

Hook React que:
- Recebe lista de monitoramentos
- Executa busca sequencial via `buscarPjeComunicaPaginado`
- Retorna progresso e resultados

### 3. `src/components/djen/BotaoSincronizarDjen.tsx` (NOVO)

Componente de botão com:
- Estado de loading
- Progresso (X de Y monitoramentos)
- Toast de sucesso/erro

### 4. `src/pages/MonitoramentoDjen.tsx`

Adicionar o botão de sincronização na área de ações

---

## Detalhes Técnicos

### Lógica de Variantes de Busca Melhorada

```text
Entrada: "União Quimica Farmacêutica Nacional"

Processamento:
1. Original: "União Quimica Farmacêutica Nacional"
2. Sem acentos: "Uniao Quimica Farmaceutica Nacional"
3. Prefixo (2 palavras): "Uniao Quimica"

Todas as variantes são buscadas sequencialmente,
resultados são agregados e deduplicados por ID.
```

### Fluxo de Sincronização via Navegador

```text
[Usuário clica "Sincronizar"]
         |
         v
[useSincronizarDjenBrowser]
         |
         | Busca monitoramentos ativos
         v
[monitoramentos_djen] (Supabase)
         |
         | Para cada monitoramento:
         v
[buscarPjeComunicaPaginado] (pjeComunicaClient.ts)
         |
         | IP do usuário (não bloqueado)
         v
[comunicaapi.pje.jus.br]
         |
         | Retorna publicações
         v
[Verifica hash global para evitar duplicatas]
         |
         v
[Insere em publicacoes_djen] (Supabase)
```

### Hash de Deduplicação

O sistema já usa `generateGlobalHash(conteudo, dataDisponibilizacao)` para evitar duplicatas. A sincronização via navegador deve usar a mesma lógica:

1. Calcular hash da publicação
2. Verificar se existe em `publicacoes_djen_global_hash`
3. Se não existe, inserir em `publicacoes_djen` e registrar hash

---

## Resultado Esperado

Após implementação:

1. **Publicação TJDFT 0705883-56.2026** (29/01): Capturada pela variante "UNIAO QUIMICA"
2. **Publicação TJRJ 0098834-12.2016** (29/01): Capturada pela variante "UNIAO QUIMICA"
3. **Publicação TJRS 5292250-81.2024** (29/01): Capturada pela variante "UNIAO QUIMICA"
4. **Publicação TJSP 1007378-45.2019** (29/01): Capturada pela variante "UNIAO QUIMICA"
5. **Publicação TJSP 0007895-08.2025** (29/01): Capturada pela variante "UNIAO QUIMICA"

---

## Ação Imediata Recomendada

Enquanto a implementação completa é feita, executar manualmente:

1. Na tela de Buscar DJEN, pesquisar por "UNIAO QUIMICA" para cada tribunal (TJDFT, TJRJ, TJRS, TJSP)
2. As publicações encontradas serão inseridas automaticamente

Isso garante que as publicações do Dr. Thomás apareçam hoje enquanto a solução definitiva é implementada.

