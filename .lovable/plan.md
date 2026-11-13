# Perfis de acesso por coordenação (Coordenação, Controladoria, Básico)

## O que muda para a equipe
Cada pessoa da coordenação passa a ter um **nível de acesso**. Esse nível define quais menus ela vê:

| Menu | Básico (advogado, estagiário, assistente) | Controladoria | Coordenação |
|---|---|---|---|
| Painel de controle | sim | sim | sim |
| Minhas responsabilidades | sim | sim | sim |
| Processos e casos | sim | sim | sim |
| Indicadores | sim | sim | sim |
| Configuração de notificações | sim | sim | sim |
| Clientes | sim | sim | sim |
| Documentos | sim | sim | sim |
| Manual do sistema | sim | sim | sim |
| Monitoramento | não | sim | sim |
| Análise DJEN | não | sim | sim |
| Modelos de checklist | não | não | sim |
| Modelos de tarefas | não | não | sim |
| Minhas credenciais | não | não | sim |
| Ranking de atendimento | não | não | sim |
| Workflows | não | não | sim |
| Etiquetas | não | não | sim |
| Demais telas de configuração | não | não | sim |

- Na gestão da coordenação, ao lado de cada membro, aparece a escolha **Nível: Coordenação / Controladoria / Básico**.
- Só coordenadores e admin podem mudar o nível de alguém.
- Admin continua vendo tudo.
- Quem está em mais de uma coordenação fica com o nível **mais alto** que tiver.
- A liberação ou o bloqueio individual de um menu, que já existe hoje, continua valendo e tem prioridade sobre o nível.
- Se a pessoa abrir uma tela bloqueada pelo endereço direto, ela vê o aviso "Seu perfil não tem acesso a esta tela" e volta ao Painel.

## Ponto em aberto
A Controladoria começa com os menus da tabela acima. Quando o cliente detalhar as áreas dela, ajusto só a coluna Controladoria, sem refazer o resto.

Pergunta: menus que hoje aparecem e não estão na lista do cliente (por exemplo Distribuição TST e Pautas de Julgamento) ficam para todos ou só para a Coordenação? O plano deixa esses menus **como estão hoje**.

## Detalhes técnicos
- `membros_coordenacao.cargo` ganha o valor `controladoria` (snake_case). Os cargos atuais são mapeados assim: `coordenador`/`assistente_coordenador` → coordenação; os demais → básico. Nenhum dado muda.
- Nova matriz em `src/config/perfisAcesso.ts` (nível → lista de `menu_path`), com teste para cada linha da tabela.
- `useMenuPermissions` combina três regras: override individual (`permissoes_menu_usuario`), depois o nível mais alto de `membros_coordenacao`, depois o padrão. A barra lateral, o `MobileBottomNav` e um guard de rota usam o mesmo `isMenuAllowed`.
- Seletor de nível no card de membros da página de gestão da coordenação; a atualização confirma a linha retornada (proteção contra RLS).
- É controle de tela, não RLS: os dados continuam protegidos pelas regras de coordenação atuais. Registro em AGENTS.md.
