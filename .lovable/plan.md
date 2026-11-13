# Acesso aos menus por cargo ou por membro, em cada coordenação

## O que muda para a equipe
- **Por padrão, todos os menus ficam liberados para todos.** Nada muda até o coordenador decidir.
- Na gestão da coordenação aparece o cartão **Acesso aos menus**, com duas abas:
  - **Por cargo:** uma grade com os menus nas linhas e os cargos da coordenação nas colunas (Coordenador, Assistente de coordenação, Controladoria, Advogado, Estagiário, Assistente…). Cada cruzamento tem uma chave liga/desliga.
  - **Por membro:** escolhe-se uma pessoa e liga ou desliga cada menu só para ela. Isso vale acima do cargo.
- O cargo **Controladoria** passa a existir na lista de cargos dos membros.
- Só coordenadores da coordenação e admin mudam esses acessos. Admin sempre vê tudo.
- A ordem de prioridade é: regra do membro, depois regra do cargo, depois liberado.
- Quem está em mais de uma coordenação vê um menu se **alguma** delas liberar para essa pessoa.
- Se a pessoa abrir uma tela bloqueada pelo endereço direto, ela vê o aviso "Seu perfil não tem acesso a esta tela" e volta ao Painel.

## Detalhes técnicos
- `membros_coordenacao.cargo` aceita o novo valor `controladoria` (snake_case). Nenhum dado existente muda.
- Nova tabela `permissoes_menu_coordenacao` com os campos coordenacao_id, cargo (nulo quando a regra é de membro), user_id (nulo quando a regra é de cargo), menu_path e permitido, com índices únicos. Ela recebe GRANT e RLS: leitura para membros da coordenação e escrita para admin ou coordenadores dela. Sem registro, o menu fica permitido.
- O `permissoes_menu_usuario` global continua existindo e tem a maior prioridade.
- `useMenuPermissions` resolve as regras na ordem: global do usuário, membro na coordenação, cargo na coordenação (basta uma coordenação liberar), padrão liberado. A barra lateral, o `MobileBottomNav` e um guard de rota usam o mesmo `isMenuAllowed`.
- A lógica de prioridade fica numa função pura, com testes do padrão liberado, de membro acima de cargo e do caso de várias coordenações.
- As gravações confirmam a linha retornada, para não mostrar sucesso falso quando o RLS bloquear.
- É controle de tela, não RLS: os dados continuam protegidos pelas regras de coordenação atuais. Registro em AGENTS.md.
