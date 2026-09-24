# Correções pedidas pela Jéssica (Coordenação Dra. Beatriz Costa)

## O que verifiquei na base

**1. Itens de workflow sem publicação: procede.**
- Quando um workflow começa a partir de uma publicação, só o primeiro item fica ligado a ela. Desde 10/09: 50 de 51 primeiros itens estão ligados.
- Os itens criados depois, conforme cada etapa é concluída, não recebem o vínculo. Só 1 de 32 está ligado. Por isso eles aparecem sem a publicação no Painel.

**2. Pessoas baixando itens de outras: procede.**
- Hoje, quem tem acesso ao processo consegue mudar a situação de qualquer item dele, mesmo sem ser responsável.
- Exemplos reais: a Larissa (estagiária) mudou de "Cumprido" para "Baixado" itens do Eduardo, da Jéssica/Felipe e da Estephany (23 e 24/09). O Saulo baixou 5 itens da Ana Júlia hoje, entre 16:15 e 16:32 (BRT).
- Os itens já alterados não serão mexidos, como a senhora pediu.

## O que será feito

### A. Vínculo da publicação em todas as etapas do workflow
- Cada novo item criado pelo workflow (prazo, tarefa ou audiência) passa a herdar a mesma publicação de origem do workflow.
- Os 31 itens já criados sem o vínculo serão ligados à publicação de origem. Isso só adiciona o vínculo e não altera situação, datas nem responsáveis.

### B. Nova configuração no menu Coordenações: "Alterar itens de outras pessoas"
- Em cada coordenação, uma nova opção define quem pode mudar a situação de itens em que **não** é responsável nem correspondável.
- É possível marcar perfis (coordenador, assistente de coordenação, advogado, assistente, estagiário, secretaria) e/ou usuários específicos.
- Padrão para coordenações ainda não configuradas: só responsáveis, correspondáveis, coordenadores e admin.
- Quem não tiver permissão vê a situação do item de outra pessoa como somente leitura, com o aviso "Somente o responsável pode alterar a situação".
- A regra vale em todos os lugares onde a situação pode ser mudada: Painel (lista, kanban, equipe), agenda, ficha do processo e alteração em lote.
- A regra também é conferida no servidor, então não dá para contornar pela tela.
- Admin continua podendo tudo.

## Detalhes técnicos
- `workflowExecutor.ts`: ao criar o item da próxima etapa (~linha 711), ler `publicacao_origem_tipo/id` da execução e reutilizar a mesma lógica de vínculo hoje em `IniciarWorkflowDialog` (extrair para `src/lib/vincularItemPublicacao.ts`). Backfill via `run_sql` inserindo em `tarefas_publicacoes` / `tarefas_publicacoes_processos` / `audiencias_publicacoes*` a partir de `workflow_execucao_etapas` + `workflow_execucoes`, com `ON CONFLICT DO NOTHING`.
- Nova tabela `config_alteracao_itens_terceiros` (coordenacao_id único, perfis text[], usuarios uuid[], timestamps), com GRANTs e RLS: leitura para membros, edição para admin/coordenador da coordenação.
- Função `pode_alterar_situacao_item(user, tarefa_id)` SECURITY DEFINER: responsável, `tarefa_responsaveis`, admin, coordenador ou perfil/usuário configurado (cargo em `membros_coordenacao` tem prioridade sobre o perfil global, igual a `usePermissoesSituacao`).
- Trigger BEFORE UPDATE em `tarefas`: se `status` mudar e a função retornar falso, bloqueia com mensagem clara. Service role e rotinas automáticas (workflow/monitoramento) continuam liberadas.
- Frontend: hook `usePodeAlterarItem`, usado nos seletores de situação (Painel, MinhaAgenda, ProcessoItensLateral, TarefaAgendaPanel, lote), e novo diálogo no menu Coordenações seguindo o padrão de `PermissoesSituacaoDialog`.
