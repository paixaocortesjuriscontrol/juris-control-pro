# Ajustes solicitados pela Dra. Beatriz Costa

## 1. Relatório de Auditoria da Coordenação em PDF

Nova ação **Relatório de Auditoria (PDF)** na tela de Auditoria de Itens (`/auditoria-itens`), visível apenas para administrador, coordenador e assistente coordenador.

- Filtros: coordenação, período (data inicial/final), usuário (opcional) e tipo de item (prazo, audiência, evento, tarefa).
- Conteúdo: todas as alterações auditadas dos itens da coordenação — data/hora (BRT), autor (nome + e-mail), item (título, tipo, processo), ação (criar/atualizar/excluir), campo alterado, valor anterior e valor novo.
- Destaque visual para alterações de **responsável/envolvidos** e de **situação**, que são o foco da reclamação (troca automática de responsável).
- Ordenação cronológica decrescente, com quebra de página por dia e resumo no topo (total de alterações, por usuário e por tipo de campo).
- Geração no navegador com `jspdf` + `jspdf-autotable` (mesmo padrão já usado no relatório do Compara Docs TST).

## 2. Horários das exportações Excel em BRT

Causa confirmada: na exportação de atividades do Painel de Controle o horário é extraído por texto direto do valor ISO (`extractHora` lê os caracteres depois do `T`). Quando o campo é `timestamptz`, o valor volta em UTC (ex.: `T13:00:00+00:00`) e a planilha mostra 13:00 em vez de 10:00 BRT.

Correção:
- Criar utilitário único `horaBrt(valor)` em `src/utils/date.ts`, que converte qualquer data/hora com fuso para `America/Sao_Paulo` e mantém intacto o texto quando o valor já é apenas "HH:mm".
- Usar esse utilitário na exportação de atividades (Painel de Controle) e nas exportações de audiências (**Pauta Semanal para Diretoria** e `useExportarAudiencias`).
- Nas audiências, priorizar `hora_brasilia` → `hora_local` → `hora` antes de qualquer conversão, evitando duplo deslocamento.
- Aplicar a mesma regra nas colunas de data/hora de criação e cumprimento das planilhas.

## 3. Reagendamento de audiências

Já corrigido em pedido anterior (campo "Nova data do reagendamento" opcional). Nenhuma ação nova.

## 4. Concluir passa a ser apenas uma situação

Causa levantada na auditoria: não há gatilho no banco fazendo isso. Os registros mostram o mesmo usuário salvando "protocolado"/"baixado" e, 1 a 2 segundos depois, uma segunda gravação com `status = cumprido` + `data_cumprimento` — a assinatura da ação rápida **Concluir**.

Correção: remover o botão/ação rápida "Concluir" das telas de itens. A conclusão passa a existir só como situação escolhida no formulário — **Concluído com sucesso** ou **Concluído sem sucesso** — e nada mais é alterado automaticamente.

## 5. Quem pode usar "Concluído com sucesso"

"Concluído com sucesso" **não** é restrito ao coordenador. Continua liberado para todos, salvo se a coordenação restringir a situação no menu **Permissões de Situação por Tipo de Tarefa**. Com a remoção do botão rápido, essa configuração passa a valer para todos os caminhos de conclusão. Nenhuma outra alteração.

## Detalhes técnicos

- `src/pages/AuditoriaItens.tsx`: novo botão e diálogo de filtros; geração do PDF em `src/lib/relatorioAuditoriaCoordenacaoPdf.ts` (consulta paginada em `auditoria_tarefas` + `profiles_basic` para nome/e-mail).
- `src/utils/date.ts`: novos helpers `horaBrt()` e `dataHoraBrt()`.
- `src/pages/PainelControle.tsx`: substituir `extractHora` por `horaBrt`.
- `src/components/audiencias/RelatorioAudienciasDiretoria.tsx` e `src/hooks/useExportarAudiencias.ts`: hora com prioridade BRT.
- `src/components/agenda/TarefaAgendaPanel.tsx` e demais listas/kanban: remover o botão e o handler de "Concluir" (a conclusão fica somente pela seleção de situação).
- Sem alterações de banco de dados.
- Versão do menu atualizada para **v4.4.8**.