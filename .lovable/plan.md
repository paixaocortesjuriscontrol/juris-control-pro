

# Planilha TST — Plano Atualizado com Detalhes de IA e Atributos

## Objetivo
Nova página `/planilha-tst` que recebe 4 arquivos `.xlsx` e cruza os dados para complementar o Input 1 (Distribuições) com informações dos outros 3 inputs, usando **número do processo** como chave. Quando o cruzamento determinístico não encontrar dados, a IA complementa via API OpenAI (GPT-4o-mini) usando a mesma `OPENAI_API_KEY` já configurada na tela de Analisar Prazos.

## Atributos Preenchidos por Passo

### Passo 1.1 — Cruzar Input 1 com Input 2 (Relatório de Prazos) e Input 3 (Processos TST)

Para cada linha do Input 1, buscar pelo número do processo nos Inputs 2 e 3 e preencher os campos **vazios**:

| Coluna no Input 1 | Fonte prioritária | Fallback |
|---|---|---|
| **DOSSIÊ** | Input 2 | Input 3 |
| **EQUIPE** | Input 2 | Input 3 |
| **RECLAMANTE** | Input 2 | Input 3 |
| **RECLAMADA** | Input 2 | Input 3 |
| **RELATOR** | Input 2 | Input 3 |

### Passo 1.2 — Cruzar Input 1 com Input 4 (Dossiês Ativos)

Para processos com campos **ainda vazios** após o Passo 1.1, buscar no Input 4:

| Coluna no Input 1 | Fonte |
|---|---|
| **DOSSIÊ** | Input 4 |
| **EQUIPE** | Input 4 |
| **RECLAMANTE** | Input 4 |
| **RECLAMADA** | Input 4 |

(RELATOR não é buscado no Input 4)

### Passo 2 — IA para processos não encontrados

Processos que permaneceram com campos vazios após os passos 1.1 e 1.2 serão enviados para a IA (OpenAI GPT-4o-mini) para tentativa de complementação. A IA usa a mesma `OPENAI_API_KEY` já configurada no projeto (mesma da tela Analisar Prazos).

## Arquivos a Criar/Modificar

### 1. `src/pages/PlanilhaTst.tsx` (novo)
- Layout com `MainLayout`, visual similar ao `AnalisarPrazos.tsx`
- 4 campos de upload `.xlsx` com labels descritivos
- Botão "Processar Planilhas"
- Lógica de cruzamento client-side com `xlsx`:
  - Normalização do número de processo: `str.replace(/[\.\-\s\/]/g, "")`
  - Detecção automática de cabeçalhos (busca case-insensitive por "processo", "dossiê", "equipe", etc.)
  - Passo 1.1: preenche DOSSIÊ, EQUIPE, RECLAMANTE, RECLAMADA, RELATOR do Input 2 e Input 3
  - Passo 1.2: complementa DOSSIÊ, EQUIPE, RECLAMANTE, RECLAMADA do Input 4
- Para processos ainda incompletos, chamada à edge function para análise IA
- Tabela de resultados com destaque visual (cor/ícone) indicando origem do dado: cruzamento vs IA vs não encontrado
- Contadores: total de processos, complementados no passo 1.1, complementados no passo 1.2, complementados por IA, não encontrados
- Botão "Baixar Planilha" gera Input 1 atualizado como `.xlsx`

### 2. `supabase/functions/complementar-planilha-tst/index.ts` (novo)
- Edge function que recebe processos com campos faltantes
- Usa `OPENAI_API_KEY` (mesma já configurada) com modelo `gpt-4o-mini`
- Chamada à API OpenAI com tool calling (mesmo padrão de `analisar-prazos-drive`)
- Prompt especializado para identificar DOSSIÊ, EQUIPE, RECLAMANTE, RECLAMADA, RELATOR a partir do número do processo e dados parciais disponíveis
- Retorna os campos complementados

### 3. `src/App.tsx`
- Adicionar rota `/planilha-tst` com `ProtectedRoute`

### 4. `src/components/layout/Sidebar.tsx`
- Adicionar "Planilha TST" no menu, próximo a "Analisar Prazos", com ícone `Table2`

## Detalhes Técnicos
- Processamento de cruzamento 100% client-side com biblioteca `xlsx` (já instalada)
- Apenas processos não encontrados no cruzamento são enviados para a edge function (economia de chamadas à API)
- A edge function usa `OPENAI_API_KEY` + `gpt-4o-mini` — mesma configuração da tela Analisar Prazos
- Processos enviados em lotes de 10 para a IA (mesmo padrão existente)

