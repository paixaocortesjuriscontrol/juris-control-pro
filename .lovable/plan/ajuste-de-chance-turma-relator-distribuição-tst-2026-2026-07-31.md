# Ajuste de Chance Turma/Relator — Distribuição TST (2026+)

## Objetivo
Nos processos distribuídos a partir de 2026 que estão **Prontos para enviar (sem pendência)**, quando o **Recurso do Reclamante** estiver preenchido e **Tem chance de êxito = SIM**, inverter as marcações de **Chance Turma** e **Chance Relator** que estejam **FAVORÁVEL** para **DESFAVORÁVEL**, e gerar um relatório Excel com todos os processos alterados.

## Escopo
- Somente processos **Prontos para enviar (sem pendência)** com distribuição a partir de 01/01/2026. Nenhum outro processo é tocado.
- "Pronto sem pendência" é calculado pelas regras de `distribuicaoTstPendencias` (mesma lógica do card da tela), portanto a lista final sai desse filtro — não de um recorte por ano.
- Dentro desse conjunto, só entram os que têm Recurso do Reclamante preenchido e "Tem chance de êxito = SIM".
- Os valores gravados são exatamente `FAVORÁVEL` / `DESFAVORÁVEL` dentro do JSON `materias_analise_reclamante` (por matéria: aparelhamento, chance_turma, chance_relator, chance_exito).
- O total exato de processos elegíveis é apurado e exibido na pré-visualização antes de qualquer gravação.

## Como vai funcionar
1. Nova ação na tela Distribuição TST: botão **"Ajustar Chance Turma/Relator (2026+)"**, no grupo de ações administrativas.
2. Ao acionar, o sistema:
   - busca em lotes os registros com distribuição a partir de 01/01/2026 e descarta imediatamente todos que tenham qualquer pendência, mantendo apenas os **Prontos para enviar**;
   - dentro desses, mantém apenas os com recurso do reclamante preenchido (tipo/matérias) e êxito = SIM;
   - em cada matéria da análise do reclamante, troca `FAVORÁVEL` por `DESFAVORÁVEL` em Chance Turma e Chance Relator (demais campos intactos);
   - grava em lotes de 200 com barra de progresso detalhada (processo/dossiê atual) e botão **Cancelar**.
3. Antes de gravar, exibe resumo de pré-visualização (quantos processos e quantas matérias serão alterados) para confirmação.
4. Ao final, download automático do relatório Excel.

## Relatório Excel
Uma aba "Alterados", uma linha por matéria alterada:
Processo | Dossiê | Equipe | Data Distribuição | Relator | Turma | Matéria | Chance Turma (antes → depois) | Chance Relator (antes → depois) | Chance Êxito | Alterado em

## Detalhes técnicos
- Novo utilitário `src/lib/ajustarChanceReclamanteTst.ts`: seleção por ano + `getPendencias(row).length === 0`, transformação imutável do JSONB, updates em chunks via Supabase, callbacks de progresso/cancelamento.
- Novo utilitário `src/lib/relatorioAjusteChanceTst.ts` para o Excel (padrão dos relatórios existentes, datas em DD/MM/AAAA).
- Novo diálogo `src/components/distribuicao-tst/AjustarChanceDialog.tsx` (progresso + cancelar + resumo), acionado de `DistribuicaoTst.tsx`.
- Sem alterações de schema; apenas atualização de dados na coluna `materias_analise_reclamante`.
- Após concluir, invalidação das queries da Distribuição TST antes de fechar o diálogo.