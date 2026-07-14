Plano de correção:

1. Vinculação obrigatória da publicação ao processo
- Ajustar a rotina `ensureProcessoFromPublicacao` para, ao encontrar ou criar o processo, gravar o `processo_id` também na própria publicação DJEN (`publicacoes_djen` ou `publicacoes_djen_processos`, conforme a origem).
- Garantir que Tarefa, Prazo, Evento e Audiência chamados pelo botão Adicionar da Análise DJEN resolvam/criem o processo no momento do salvamento, não só ao abrir o formulário, evitando corrida onde o item salva sem `processo_id`.
- Invalidar os caches da Análise DJEN e do processo após salvar para o link “Ver processo” aparecer sem refresh.

2. Separar Tarefa de Prazo em todas as listas do processo
- Criar uma regra única de identificação: `tipo_tarefa === "PRAZO"` é prazo; não entra em tarefas.
- Na tela do processo, filtrar a aba/lista de Tarefas para excluir prazos.
- No quadro lateral “Pendências do Processo”, criar seção própria “Prazos”, em vermelho, e remover prazos da seção “Tarefas”.
- Ajustar contadores laterais para Tarefas e Prazos ficarem separados.

3. Alterar o rótulo do campo Assunto
- Trocar o label visual de “ASSUNTO” para “OBJETO DA AÇÃO (ASSUNTO)” na visão geral/edição do processo, mantendo o mesmo campo de banco (`assunto`).

4. Refazer Pedidos sem janela/modal
- Remover o modal de “Novo Pedido” e transformar o botão Adicionar em um formulário inline na própria aba Pedidos.
- Manter a edição na própria tela, sem abrir nova janela.
- Na lista de pedidos, exibir claramente:
  - resultado da sentença: Improcedente, Procedente ou Parcialmente procedente;
  - resultado do recurso: Provido, Parcialmente provido ou Não provido;
  - turma;
  - relator.

5. Banco de dados para os novos dados de pedidos
- Criar migration adicionando campos em `pedidos_processo` para resultado de sentença, resultado de recurso, turma e relator.
- Atualizar tipos Supabase e hook de pedidos para salvar/editar/listar esses campos.
- Preservar dados antigos, sem apagar os campos atuais.

6. Validação
- Conferir fluxo da Análise DJEN: criar tarefa, prazo, evento e audiência a partir da mesma publicação deve deixar todos com `processo_id` e a publicação com link para o processo.
- Conferir no processo: prazo aparece apenas em Prazos/pendências de prazo, tarefa apenas em Tarefas/pendências de tarefa.
- Conferir Pedidos: adicionar e editar inline, sem modal.