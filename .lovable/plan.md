## Objetivo

Adicionar, no menu de 3 pontinhos de cada membro dentro de uma coordenação (tela Coordenações), a opção **"Nível de Acesso"**, onde é possível definir quais opções de menu aquele usuário pode ver/acessar. Por padrão, **todas as opções vêm marcadas**. Somente **administrador** e **coordenador** (incluindo assistente coordenador) podem abrir e alterar.

## Banco de dados

Nova tabela `permissoes_menu_usuario`:
- `user_id` (usuário alvo)
- `menu_path` (ex: `/processos`, `/analise-djen`)
- `permitido` (booleano)
- registro único por usuário + item de menu
- campos padrão de data de criação/atualização

Regras de acesso:
- O próprio usuário pode ler suas permissões (necessário para o menu funcionar).
- Administradores e coordenadores/assistentes coordenadores podem ler e alterar as permissões dos membros.
- Ausência de registro = **permitido** (padrão "tudo liberado"), então nada muda para os usuários atuais.

## Interface

1. **Coordenações → membro → 3 pontinhos → "Nível de Acesso"** (novo item, acima de "Remover da equipe"), visível apenas para admin/coordenador.
2. Novo diálogo `NivelAcessoDialog`:
   - Cabeçalho com nome do membro.
   - Chave "Marcar todos / Desmarcar todos".
   - Lista de todas as opções do menu lateral (públicas + administrativas), agrupadas como na sidebar, cada uma com um checkbox — todas marcadas por padrão.
   - Itens que o membro já não alcança pelo próprio perfil (ex.: telas exclusivas de admin) aparecem desabilitados e sinalizados, para evitar falsa impressão de liberação.
   - Botões Cancelar / Salvar, com feedback de sucesso e recarregamento do cache.

## Aplicação das permissões

- Novo hook `useMenuPermissions()` que carrega as permissões do usuário logado.
- `Sidebar.tsx`: além dos filtros atuais de perfil, esconde itens marcados como não permitidos.
- Guarda de rota: ao acessar diretamente uma URL bloqueada, o usuário é redirecionado para a tela inicial com aviso — as restrições de perfil e RLS existentes continuam valendo como camada principal de segurança.

## Detalhes técnicos

- A lista de itens de menu será extraída de `Sidebar.tsx` para um módulo compartilhado (`src/config/menuItems.ts`) para ser reutilizada pelo diálogo, pelo hook e pela guarda de rota.
- Permissões são gravadas somente quando diferentes do padrão (grava-se apenas os itens desmarcados), mantendo a tabela enxuta.
- Alteração de versão do sistema para `4.2.9`.
