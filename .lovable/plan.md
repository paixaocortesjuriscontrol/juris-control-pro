## O que muda

1. **Formulário de Tarefa** (acionado pelo botão Adicionar em Painel de Controle e Análise DJEN):
   - Remover o campo "Tipo de Tarefa" (será fixado internamente como "TAREFA EQUIPE" ou similar).
   - Trocar o select de Responsável único por seleção múltipla (mesmo componente usado em Audiência).
   - Adicionar campo "Envolvidos" (também múltiplo) — pessoas que apenas acompanham.

2. **Formulário de Evento** (`EventoDialog`):
   - Adicionar múltiplos Responsáveis e múltiplos Envolvidos.

3. **Formulário de Prazo** (`PrazoDialog`):
   - Adicionar múltiplos Responsáveis e múltiplos Envolvidos.

4. **Formulário de Audiência** (`CadastroAudienciaForm`):
   - Já tem múltiplos responsáveis. Adicionar campo "Envolvidos".

5. **Acompanhamento (Envolvidos)**: as pessoas marcadas como envolvidas recebem notificação informativa e veem o item nas listas/painéis delas, mas não são donas da execução.

## Mudanças de banco (migration)

Como hoje `tarefas`, `eventos_agenda` e prazos (tarefas tipo PRAZO) guardam apenas `responsavel_id` único, criar tabelas de vínculo:

- `tarefa_responsaveis` (tarefa_id, usuario_id) — papel principal
- `tarefa_envolvidos` (tarefa_id, usuario_id) — papel observador
- `evento_responsaveis` (evento_id, usuario_id)
- `evento_envolvidos` (evento_id, usuario_id)
- `audiencia_envolvidos` (audiencia_id, usuario_id) — audiência já tem `audiencias_advogados` como responsáveis

Prazos reutilizam `tarefa_responsaveis`/`tarefa_envolvidos` (continuam linhas de `tarefas`).

Todas com RLS: membros da coordenação do processo podem ler/escrever; service_role total. Manter `responsavel_id` legado preenchido com o primeiro responsável escolhido para não quebrar telas existentes.

## Arquivos a editar

- `supabase/migrations/<novo>.sql` — criar as 5 tabelas + GRANTs + RLS + índices.
- `src/components/djen/CriarTarefaPublicacaoDialog.tsx` (formulário "Tarefa" acionado por Adicionar): remover Tipo de Tarefa, trocar Responsável por múltiplos, adicionar Envolvidos.
- `src/components/agenda/EventoDialog.tsx`: adicionar Responsáveis (múltiplos) e Envolvidos.
- `src/components/prazos/PrazoDialog.tsx`: adicionar Responsáveis (múltiplos) e Envolvidos.
- `src/components/audiencias/CadastroAudienciaForm.tsx`: adicionar Envolvidos.
- Pequeno componente compartilhado `src/components/shared/MultiUserSelect.tsx` para reuso (lista de membros da coordenação + chips).

## Pontos a confirmar com você

1. Para Tarefa, qual valor fixo de `tipo_tarefa` salvar internamente (já que o campo sai do formulário)? Sugestão: `TAREFA EQUIPE`.
2. Envolvidos devem receber notificação automática (e-mail/sino) na criação? Sugestão: somente notificação interna (sino), sem WhatsApp/e-mail.
3. Em telas de listagem (Painel de Equipe, Minha Carteira, Kanbans), Envolvidos devem ver o item como "acompanhando" ou ficamos só com cadastro nesta etapa e exibimos depois?
