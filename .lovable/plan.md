

# Plano: Criar tela "Carga Benner"

## Objetivo
Nova página que recebe 2 inputs (planilha complementada TST + Pautas de Julgamento), cruza os dados por número de processo/dossiê, e gera como output a planilha "Layout Carga - módulo TST" para envio ao Banco Santander.

## Mapeamento de Dados (Input → Output)

### Input 1: Planilha Complementada (resultado da tela Planilha TST)
Colunas: DATA DA DISTRIBUIÇÃO, NÚMERO DO PROCESSO, DOSSIÊ, EQUIPE, RECLAMANTE, RECLAMADA, RELATOR, RELATOR (+/-), TURMA, TURMA (+/-), PARTE RECORRENTE, TIPO DE RECURSO DO RECLAMANTE, MATÉRIAS RECURSO RECLAMANTE, APARELHAMENTO, CHANCE DE ÊXITO, TIPO DE RECURSO DO BANCO, MATÉRIAS RECURSO DO BANCO, APARELHAMENTO, CHANCE DE ÊXITO, HONRA, DECISÃO, MÍDIA NEGATIVA, BENNER ATUALIZADO?

### Input 2: Pautas de Julgamento
Colunas: DOSSIÊ, NUMERO DO PROCESSO, DATA DO JULGAMENTO, HORARIO, VIRTUAL/TELEPRESENCIAL/HÍBRIDO, RELATOR, ORGÃO, SUSTENTAÇÃO ORAL, ENTREGA DE MEMORIAS, RESULTADO

### Output: Layout Carga - módulo TST (35 colunas)

| Coluna Output | Fonte |
|---|---|
| Dossiê | Input 1 |
| Tribunal | Fixo: "TST" |
| Tipo de Recurso | Input 1 (tipo recurso banco ou reclamante) |
| Data da distribuição | Input 1 |
| Turma | Input 1 |
| Relator | Input 1 |
| Análise do quarteirizado | Input 1 (DECISÃO) |
| Há risco de mídia negativa? | Input 1 (MÍDIA NEGATIVA) |
| Risco | Vazio |
| Há discussão sobre provas digitais? | Padrão "NÃO" |
| Temos data de julgamento? | "SIM" se match no Input 2, senão "NÃO" |
| Data Julgamento | Input 2 (DATA DO JULGAMENTO) |
| Horário | Input 2 (HORARIO) |
| Tipo Julgamento | Input 2 (VIRTUAL/TELEPRESENCIAL) |
| Matéria de Honra | Input 1 (HONRA) |
| Entrega de Memoriais | Input 2 |
| Sustentação Oral | Input 2 |
| Sem transcendência...Outra (5 cols resultado) | Vazio (preenchimento posterior) |
| Observações | Vazio |
| Ganhamos / Perdemos | Vazio |
| Processo baixado | Padrão "NÃO" |
| Recorrente | Input 1 (PARTE RECORRENTE) |
| Turma Favorável/Desfavorável | Derivado de TURMA (+/-) |
| Relator Favorável/Desfavorável | Derivado de RELATOR (+/-) |
| Recurso Bem/Mal aparelhado | Input 1 (APARELHAMENTO) |
| Chance de êxito | Input 1 (CHANCE DE ÊXITO) |

## Arquivos a Criar/Modificar

### 1. `src/pages/CargaBenner.tsx` (novo)
- Estrutura idêntica à PlanilhaTst.tsx (layout, cards, progress, etc.)
- **Input 1**: Upload da planilha complementada (todas as abas)
- **Input 2**: Upload da planilha de Pautas de Julgamento
- Processamento:
  1. Ler ambos os inputs via Web Worker
  2. Criar lookup de Pautas por número de processo normalizado (CNJ 20 dígitos) e por dossiê
  3. Para cada linha do Input 1, mapear para as 35 colunas do Layout
  4. Cruzar com Pautas para preencher campos de julgamento
- **Output**: Download da planilha Layout preenchida (.xlsx)
- Dashboard com estatísticas: total de processos, matches com pautas, campos preenchidos
- Barra de progresso por fases

### 2. `src/workers/cargaBennerReader.worker.ts` (novo)
- Reutiliza o padrão do `planilhaTstReader.worker.ts`
- Lê ambos os inputs com `defval: ""` para manter alinhamento de colunas
- Detecta cabeçalhos via scoring

### 3. `src/components/layout/Sidebar.tsx` (modificar)
- Adicionar item "Carga Benner" no menu, com ícone `Upload` e cor `text-sky-400`
- Posicionar após "Planilha TST"

### 4. `src/App.tsx` (modificar)
- Adicionar rota `/carga-benner` com import lazy do componente
- Proteger com `<ProtectedRoute>`

## Fluxo do Usuário

1. Acessa "Carga Benner" no menu lateral
2. Faz upload da planilha complementada (Input 1)
3. Faz upload da planilha de Pautas (Input 2)
4. Clica "Processar"
5. Vê barra de progresso (Fase 1: Lendo planilhas → Fase 2: Cruzando dados → Fase 3: Gerando Layout)
6. Vê dashboard com estatísticas do cruzamento
7. Clica "Baixar Planilha Layout" para download do .xlsx final

## Detalhes Técnicos

- Cruzamento por número de processo normalizado (CNJ 20 dígitos), com fallback por dossiê
- Geração do .xlsx via SheetJS (XLSX) com os cabeçalhos exatos do Layout Carga
- A linha 2 do Layout original (com "SIM", "SIM", etc.) será usada como referência de quais campos são obrigatórios, mas não será incluída no output
- Web Worker para evitar travamento do browser
- Mesmo padrão visual e de UX da tela Planilha TST

