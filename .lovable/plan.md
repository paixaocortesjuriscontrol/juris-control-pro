# Perfis de acesso por coordenação (Coordenação, Controladoria, Básico)

## O que muda para a equipe
- Cada pessoa da coordenação passa a ter um **nível de acesso**: **Coordenação**, **Controladoria** ou **Básico** (advogado, estagiário, assistente).
- **Por padrão, todos os menus ficam liberados para todos os níveis.** Nada muda até o coordenador decidir.
- Na gestão da coordenação aparece o cartão **Perfis de acesso**: uma grade com os menus nas linhas e os três níveis nas colunas, com uma chave liga/desliga em cada cruzamento. O coordenador bloqueia o que quiser para Controladoria e para Básico.
- O botão **"Aplicar sugestão do escritório"** marca a grade de uma vez conforme o pedido do cliente: Monitoramento e Análise DJEN só para Coordenação e Controladoria; Modelos de checklist, Modelos de tarefas, Minhas credenciais, Ranking, Workflows, Etiquetas e configurações só para Coordenação. O coordenador revisa antes de salvar.
- Ao lado de cada membro aparece a escolha do nível.
- Só coordenadores e admin mudam a grade e os níveis. A Coordenação e o admin sempre veem tudo.
- Quem está em mais de uma coordenação vê um menu se **alguma** delas liberar para o nível que a pessoa tem lá.
- A liberação ou o bloqueio individual de um menu, que já existe hoje, continua valendo e tem prioridade sobre o perfil.
- Se a pessoa abrir uma tela bloqueada pelo endereço direto, ela vê o aviso "Seu perfil não tem acesso a esta tela" e volta ao Painel.

## Detalhes técnicos
- `membros_coordenacao.cargo` ganha o valor `controladoria` (snake_case). Os cargos atuais são mapeados assim: `coordenador`/`assistente_coordenador` → coordenação; os demais → básico. Nenhum dado muda.
- Nova tabela `permissoes_menu_perfil_coordenacao` (coordenacao_id, nivel, menu_path, permitido), com GRANT e RLS: leitura para membros e escrita para admin ou coordenadores da coordenação. Sem registro, o menu fica permitido. A sugestão do escritório fica em `src/config/perfisAcesso.ts`, com testes do padrão liberado e da sugestão.
- `useMenuPermissions` combina três regras: override individual (`permissoes_menu_usuario`), depois os perfis das coordenações do usuário (basta uma liberar), depois o padrão liberado. A barra lateral, o `MobileBottomNav` e um guard de rota usam o mesmo `isMenuAllowed`.
- Seletor de nível no card de membros da página de gestão da coordenação; a atualização confirma a linha retornada (proteção contra RLS).
- É controle de tela, não RLS: os dados continuam protegidos pelas regras de coordenação atuais. Registro em AGENTS.md.
