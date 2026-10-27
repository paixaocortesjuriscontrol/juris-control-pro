# Novo perfil: Assistente Jurídico Geral

## O que o usuário verá
- Novo perfil "Assistente Jurídico Geral" disponível na Administração (atribuição de perfil a usuários).
- Quem tem esse perfil vê **todas as coordenações** (processos, tarefas, prazos, eventos, audiências, publicações, agenda e indicadores), como um coordenador com acesso total.
- É **somente acompanhamento**: pode abrir e consultar tudo, mas só altera (situação, baixa, reagendamento, responsáveis, comentários de edição, exclusão) itens em que ele próprio seja **responsável ou envolvido**.
- Nos demais itens, os campos ficam travados e aparece o aviso "Somente acompanhamento — você não é responsável nem envolvido neste item".
- Não tem acesso à Administração nem às telas de gestão de coordenações (membros, permissões, configurações).

## Etapas
1. Banco: adicionar o valor `assistente_juridico_geral` ao tipo de perfis e criar a função `is_assistente_juridico_geral(uid)`.
2. Leitura: incluir esse perfil nas regras de visualização que hoje liberam coordenadores/admin (funções de acesso a processo/evento e políticas das tabelas de tarefas, eventos, audiências, processos, publicações), sem restrição de coordenação.
3. Escrita: nas regras de alteração/exclusão de tarefas, eventos e audiências, o perfil só passa quando o usuário estiver em `tarefa_responsaveis`/`tarefa_envolvidos` (e equivalentes de evento/audiência). Reaproveitar os gatilhos já existentes de bloqueio de alterações por terceiros para garantir isso no banco, não só na tela.
4. Tela:
   - `useUserRole`: reconhecer o perfil e expor `isAssistenteGeral`; ele **não** entra em `isAdminOrCoordinator` para edição, mas entra numa nova flag `podeVerTodasCoordenacoes`.
   - Seletores de coordenação e listas (agenda, tarefas, processos, DJEN, indicadores) usam essa flag para listar todas as coordenações.
   - Formulários e ações rápidas (baixa, reagendar, mudar situação, editar inline) ficam desabilitados quando o usuário não é responsável/envolvido.
   - Administração / MembroDialog: novo perfil na lista com rótulo "Assistente Jurídico Geral".
5. Testes: regra "pode editar" = responsável ou envolvido (verdadeiro/falso), e regra "vê todas as coordenações".

## Detalhes técnicos
- `ALTER TYPE app_role ADD VALUE 'assistente_juridico_geral'` em migração separada (valor de enum não pode ser usado na mesma transação).
- Perfil gravado só em `user_roles`; verificação via `has_role`.
- Prioridade em `useUserRole`: admin > coordenador > assistente_coordenador > assistente_juridico_geral > demais.
- Criação de novos itens: permitida apenas se ele for incluído como responsável/envolvido (a confirmar se deve criar itens).
