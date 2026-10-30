# Retirar usuário inativado das tarefas

## Impacto no caso da Larissa Araujo (já inativa)
- 201 vínculos de responsável em tarefas no total; só **16 estão em aberto**.
- Dessas 16, **11 têm só ela** como responsável (ficariam sem ninguém) e 5 têm outra pessoa junto.
- 2 tarefas onde ela é envolvida.
- 11 etapas de workflow com ela como responsável (é o que causou o problema da Jéssica).
- Nenhum evento ou audiência.

## O que será feito
1. Ao inativar um usuário, abrir uma janela mostrando esses números e pedir um **substituto** (opcional).
2. Nas tarefas **em aberto** (pendente, atrasado, a confirmar, em execução, revisão, minutado, reagendado):
   - remover o usuário dos responsáveis e envolvidos;
   - onde ele era o único responsável, colocar o substituto; sem substituto, a tarefa fica para a coordenação redistribuir e aparece listada no resumo.
3. Retirar o usuário das etapas de workflow e responsáveis fixos por tipo de tarefa (trocando pelo substituto, se houver).
4. Tarefas **concluídas/canceladas ficam como estão**, para preservar o histórico de quem fez.
5. Botão "Limpar usuário inativo" para aplicar o mesmo a quem já foi inativado, como a Larissa.
6. **Ao retirar um membro de uma coordenação**, a mesma janela aparece, mas a limpeza vale só para as tarefas, workflows e responsáveis fixos **daquela coordenação**; nas outras coordenações a pessoa continua como está.
7. Responsáveis não recebem aviso em massa durante a limpeza; fica registrado na auditoria.

## Detalhes técnicos
- Função no banco (SECURITY INVOKER) `desvincular_usuario(_usuario, _substituto, _coordenacao_id default null)`: sem coordenação = tudo (só admin); com coordenação = só itens dela (admin ou coordenador dela). Atua em `tarefa_responsaveis`, `tarefas.responsavel_id`, `tarefa_envolvidos`, `evento_responsaveis`, `audiencia_envolvidos`, `workflow_etapa_responsaveis/envolvidos`, `responsaveis_fixos_tipo_tarefa`, usando `app.sem_notificacao`.
- Chamada na inativação (tela de usuários), no botão de limpeza e ao remover membro na gestão da coordenação; antes, uma consulta mostra as contagens.
