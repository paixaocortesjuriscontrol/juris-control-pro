# Minhas responsabilidades

Nova página no menu lateral, **"Minhas responsabilidades"**, disponível para todos os usuários, mostrando tudo que está com a pessoa logada.

## O que a página mostra

Quatro abas, cada uma com a quantidade no título:

1. **Atividades** — tarefas, prazos, eventos e audiências em que a pessoa é **responsável ou envolvida**.
   - Selo indicando "Responsável" ou "Envolvido".
   - Filtro por situação: Todas, Pendentes, Atrasadas, Cumpridas, Canceladas (mesmos botões azuis do Painel → Equipe, com contagem).
   - Filtro por tipo (Tarefa / Prazo / Evento / Audiência) e por período (data do prazo).
   - Busca por texto (título, processo, cliente).
   - Clicar abre o item no painel lateral, como na agenda.
2. **Processos** — processos em que a pessoa está como responsável.
   - Filtro por situação do processo (ativo, encerrado, arquivado...), busca por número/cliente.
   - Clicar abre a ficha do processo.
3. **Workflows** — etapas de workflow em que a pessoa aparece como responsável ou envolvida, com o nome do workflow e a coordenação.
4. **Resumo** no topo — cartões com totais: pendentes, atrasadas, processos ativos, etapas de workflow.

Também incluir atalho no menu do celular.

## Regras

- Mostra só o que é da própria pessoa; respeita as permissões já existentes (nada novo de acesso no banco).
- Datas e "atrasado" calculados no horário de Brasília.
- Mesmas cores e risquinho da agenda (cancelado/protocolado/baixado riscado, concluído em verde).

## Detalhes técnicos

- Rota `/minhas-responsabilidades` em `App.tsx` + item no `Sidebar.tsx`.
- Atividades: reutilizar a RPC `get_agenda_pessoal(p_usuario, ...)` (já cobre responsável e envolvido) paginando sem limite de mês quando "Todas"; regra de status reaproveita o helper do filtro de Equipe (`equipeFiltroStatus`).
- Processos: `processos_responsaveis` filtrado por `user_id`, paginado em 200.
- Workflows: `workflow_etapa_responsaveis` / `workflow_etapa_envolvidos` com join em `workflow_etapas` e `workflows` (ignorando arquivados).
- Sem migração no banco; se a leitura sem período ficar lenta, limitar por padrão aos últimos 12 meses + futuros, com opção "Tudo".
- Teste para a regra de classificação "Responsável/Envolvido" e contagem por situação.
- Nova versão no menu apenas se solicitado.
