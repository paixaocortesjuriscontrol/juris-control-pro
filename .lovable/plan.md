# Retirar pessoa das tarefas ao removê-la da coordenação

## Impacto no caso da Larissa Araujo (já inativa, todas as coordenações)
- 201 vínculos de responsável em tarefas no total; só **16 estão em aberto**.
- Dessas 16, **11 têm só ela** como responsável e 5 têm outra pessoa junto.
- 2 tarefas onde ela é envolvida; 11 etapas de workflow com ela como responsável.
- Nenhum evento ou audiência.
Para limpar o caso dela, basta retirá-la da coordenação usando a nova opção.

## O que será feito
1. Na gestão da coordenação, ao clicar para retirar um membro, abre uma janela com quantas tarefas em aberto, envolvimentos e etapas de workflow ela tem **naquela coordenação**.
2. Opção "Retirar também das tarefas e workflows", com campo para escolher um **substituto** (opcional).
3. Nas tarefas **em aberto** da coordenação: remove dos responsáveis e envolvidos; onde era a única responsável, coloca o substituto (sem substituto, a tarefa fica listada no resumo para redistribuir).
4. Também retira das etapas de workflow e responsáveis fixos por tipo de tarefa da coordenação.
5. Tarefas concluídas/canceladas ficam como estão (histórico preservado). Outras coordenações não são afetadas.
6. Sem aviso em massa para os responsáveis; auditoria continua registrando.
7. A inativação na Administração **não muda**.

## Detalhes técnicos
- Função no banco (SECURITY INVOKER) `desvincular_usuario_coordenacao(_usuario, _coordenacao_id, _substituto default null)`, permitida a admin ou coordenador da coordenação; atua em `tarefa_responsaveis`, `tarefas.responsavel_id`, `tarefa_envolvidos`, `evento_responsaveis`, `audiencia_envolvidos`, `workflow_etapa_responsaveis/envolvidos`, `responsaveis_fixos_tipo_tarefa`, filtrando pela coordenação e usando `app.sem_notificacao`.
- Função de contagem para a janela de confirmação, chamada antes de remover o membro.
