# Verificação "Outro Escritório" — Admin TST

## Objetivo
Nova tela dentro de **Admin TST** que:
1. Recebe upload de planilha no formato: `Identificador Dossiê | Processo | Equipe` (cabeçalho na linha 1).
2. Verifica cada processo contra `dados_benner` (campo `processo`, normalização por dígitos do CNJ).
3. Para os encontrados, marca `processo_outro_escritorio = true`.
4. Gera relatório Excel com situação linha a linha.

## Arquivos

**Novo:** `src/pages/AdminTstOutroEscritorio.tsx`
- Card com botão de upload (.xlsx/.xls) usando `xlsx`.
- Parse da planilha (SheetJS) — lê 1ª aba, pula linhas vazias, normaliza número do processo (só dígitos, 20 chars).
- Barra de progresso durante lookup em lote.
- Preview em tabela dos resultados (encontrados x não encontrados) + botão "Baixar Relatório".
- Toggle "Marcar encontrados como Outro Escritório" (default: ligado) — só executa update se marcado.

**Novo:** `src/lib/outroEscritorioProcessor.ts`
- `processarPlanilhaOutroEscritorio(rows, { marcarFlag }) => resultado`
- Fluxo:
  1. Extrai `{ dossie, processo, equipe }` de cada linha (ignora linha vazia).
  2. Em lotes de 500, busca em `dados_benner`:
     ```
     select id, processo, dossie, equipe, situacao_processo,
            data_distribuicao_real, data_distribuicao_planilha,
            status_distribuicao, em_analise, processo_outro_escritorio
       .in('processo', batch)
     ```
  3. Carrega responsáveis via `loadResponsaveisMap` (já existe em `useDistribuicaoResponsaveis`).
  4. Se `marcarFlag`, faz `update({ processo_outro_escritorio: true }).in('id', encontradosIds)` em lotes de 200.
  5. Monta linhas do relatório.

**Novo:** `src/lib/relatorioOutroEscritorioExcel.ts`
- Gera XLSX com colunas: Dossiê | Processo | Equipe | Situação (Encontrado/Não encontrado) | Situação do Processo | Data Distribuição (DD/MM/YYYY) | Responsável | Em Análise (Sim/Não) | Status Envio.
- Para não encontrados, colunas de detalhe ficam vazias; Situação = "Não encontrado".
- Nome do arquivo: `relatorio-outro-escritorio-YYYY-MM-DD-HH-mm-ss.xlsx`.

**Editar:** `src/pages/AdminTst.tsx`
- Adicionar card/botão "Verificar Outro Escritório" no menu de Admin TST.

**Editar:** `src/App.tsx`
- Registrar rota `/admin-tst/outro-escritorio` protegida por `AdminRoute`.

## Regras
- Normalização de processo: `String(v).replace(/\D/g,'')`; comparar por dígitos. Para o `.in()` do Supabase precisamos do valor exato armazenado → estratégia: buscar por lista original + fallback com `like` por dígitos quando não achar (ou buscar todos os processos únicos e comparar em memória via mapa por dígitos, opção mais robusta para variações de formatação).
- Não altera `situacao_processo`, `status_distribuicao` nem outros campos — só `processo_outro_escritorio`.
- Se `processo_outro_escritorio` já era `true`, ainda considera "encontrado" e reporta.

## Banco
Nenhuma migração — campo `processo_outro_escritorio` já existe em `dados_benner`.

## Permissão
Rota protegida por `AdminRoute` (admin ou coordenador), consistente com o restante do Admin TST.
