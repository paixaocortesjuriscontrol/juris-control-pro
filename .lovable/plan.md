# Auditoria de itens criados/alterados via "+ Adicionar" e por publicações

Hoje já existe a tabela `auditoria_tarefas`, mas ela só é gravada em 2 lugares (Nova Tarefa e Delegar Tarefa) e não há tela para consultar. Vou instrumentar os demais fluxos do botão "+ Adicionar" e criar uma tela de consulta restrita a admin/coordenador.

## 1. Backend / instrumentação

- **Migração**:
  - Ampliar comentário/uso da `auditoria_tarefas` para cobrir `tipo_item` (tarefa | prazo | evento | audiencia | parcelamento) — adicionar coluna `tipo_item TEXT` + índice.
  - Adicionar policy de SELECT para **coordenadores** verem auditoria de itens da sua coordenação (via `has_role(auth.uid(),'coordenador')`), mantendo admin com visão global e usuário vendo o próprio.
  - Adicionar coluna `coordenacao_id UUID` para filtrar por coordenação (preenchida no insert quando disponível).
- **Instrumentar `registrarAuditoriaTarefa`** nos pontos de criação/edição/exclusão que ainda não logam:
  - `src/components/agenda/EventoDialog.tsx` (evento e audiência via agenda)
  - `src/components/audiencias/AudienciaFormSimplificado.tsx`, `EditarAudienciaDialog.tsx`, `ReagendarAudienciaDialog.tsx`
  - `src/components/agenda/GerarParcelasDialog.tsx` (parcelamentos)
  - `src/components/agenda/TarefaAgendaPanel.tsx` (edições inline)
  - Fluxos "a partir de publicação": `PreagendarIaDialog.tsx`, `CriarTarefaAudienciaDialog.tsx` — marcar `origem` como `publicacao_djen` / `publicacao_ia`.

Cada chamada envia: `acao`, `sucesso`, `tipo_item`, `origem`, `processo_id`, item_id, `dados_entrada`, `dados_saida`/`erro_*`.

## 2. Frontend — tela de consulta

- Nova rota `/auditoria-itens` protegida por um novo wrapper `AdminOrCoordRoute` (baseado no `AdminRoute`, usando `isAdminOrCoordinator` já existente em `useUserRole`).
- Novo arquivo `src/pages/AuditoriaItens.tsx`:
  - Filtros: período (data), tipo de item, ação (criar/atualizar/deletar), sucesso/falha, origem, usuário, coordenação (só admin), texto livre (processo/título).
  - Tabela paginada com colunas: data/hora (BRT), usuário, coordenação, tipo, ação, sucesso, origem, processo, título/resumo, erro.
  - Drawer de detalhes mostrando `dados_entrada` / `dados_saida` / `erro_detalhes` formatados (JSON viewer simples).
  - Botão "Exportar CSV" respeitando filtros.
- Card no menu **Administração** (`src/pages/Administracao.tsx`) chamando `/auditoria-itens`, visível para admin e coordenador.
- Item de menu no `Sidebar.tsx` na seção Administração com `adminOrCoordOnly: true`.

## 3. Escopo de visibilidade

- **Admin**: vê todas as coordenações.
- **Coordenador**: vê apenas registros com `coordenacao_id` das coordenações que ele coordena/participa (via `has_role` + `membros_coordenacao`).
- **Demais usuários**: sem acesso à tela (rota bloqueia), mantém apenas visão da própria auditoria via policy existente (não exposta na UI).

## 4. Verificação

- Criar 1 item de cada tipo pelo "+ Adicionar" e 1 a partir de publicação; confirmar registro na tabela.
- Forçar 1 erro (ex: campo obrigatório faltando) e conferir `sucesso=false` + `erro_mensagem`.
- Logar como coordenador de outra coordenação e confirmar isolamento.

## Fora do escopo

- Retroativo: só a partir da implementação (usuário já indicou preferência por "daqui pra frente" em telas anteriores; se quiser retroativo, tratar depois).
- Auditoria de outras entidades além das opções do "+ Adicionar".
