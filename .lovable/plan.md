# Workflow (fluxos de tarefas encadeadas)

Novo menu **Workflow** onde cada coordenação monta fluxos de tarefas dependentes (padrão Projuris) e os inicia em um processo. Ao iniciar, só a 1ª etapa vira tarefa real; cada etapa seguinte só nasce quando a anterior é concluída. Toda a operação acontece em listas laterais no padrão do Painel de Controle — sem abrir janelas em cascata.

## 1. Tela Workflow (`/workflow`)

Layout em duas colunas, igual ao Painel de Controle:

```text
+---------------------------+  +--------------------------------+
| Fluxos da coordenação     |  | Painel lateral (sticky)        |
| [+ Novo fluxo]            |  |  - Editar fluxo / etapas       |
| Atender Cliente Banco  8  |  |  - Prévia do fluxo             |
| Acordo / PGTO          3  |  |  - Execuções em andamento      |
+---------------------------+  +--------------------------------+
```

- Lista de fluxos filtrada pela coordenação do usuário logado (admin vê todas), com busca, contador de etapas e de execuções ativas.
- Clique no fluxo abre o painel lateral com abas: **Etapas**, **Prévia**, **Execuções**.
- Aba Etapas: lista ordenada de etapas com edição inline (sem botão "Editar"), arrastar para reordenar, duplicar e excluir.

### Campos de cada etapa
- Título (com suporte a Modelos de Título já existentes)
- Tipo do item: Prazo, Tarefa, Audiência, Evento, Parcelamento (mesmos tipos do botão Adicionar)
- Tipo de prazo: dias corridos ou dias úteis (respeitando a suspensão CLT já implementada)
- Data prevista: +N dias; Data fatal: +N dias — contados da conclusão da etapa anterior (a 1ª conta da data de início do fluxo)
- Responsáveis: pré-definidos (usuários) ou "mesmo responsável da etapa anterior" / "quem iniciou o fluxo"
- Envolvidos (opcional)
- Condição de início: "Ao iniciar o fluxo" ou "Ao concluir a etapa X com sucesso". O encadeamento é opcional: um fluxo pode ter todas as etapas com condição "Ao iniciar o fluxo" (todas nascem juntas, sem dependência), ter só algumas encadeadas, ou várias etapas disparando da mesma etapa anterior (ramificação paralela)
- Prioridade, descrição/observações, exibir no kanban

Os tipos disponíveis são exatamente os mesmos do botão **Adicionar** (Prazo, Tarefa, Audiência, Evento, Parcelamento recorrente) e cada etapa gera o item no seu formato nativo — audiência com data/hora, prazo com data limite e fatal, evento com início/fim, parcelamento com parcelas.

### Aba Prévia
Timeline vertical espelhando a prévia do Projuris: cada etapa em card com prazos previsto/fatal, condição de início e avatares dos responsáveis, além do botão **Iniciar fluxo**.

## 2. Iniciar um fluxo

Disponível em: painel lateral da tela Workflow, tela **Processos e Casos** (menu lateral do processo) e detalhe do processo.

Ao iniciar: escolhe processo, data de início e (se a etapa permitir) ajusta responsáveis. O sistema:
1. Cria a execução do fluxo vinculada ao processo e à coordenação.
2. Cria apenas as tarefas cujas etapas têm condição "Ao iniciar o fluxo" — elas já aparecem no Painel de Controle dos responsáveis, com etiquetas do processo herdadas.
3. As demais etapas ficam pendentes (não existem como tarefa ainda).

## 3. Encadeamento automático

Quando um item criado por workflow é concluído com sucesso, as etapas cuja condição aponta para ele são materializadas automaticamente:
- Datas calculadas a partir da data de conclusão (+N dias, corridos ou úteis).
- Responsáveis conforme a regra da etapa.
- Notificação/e-mail normal de nova tarefa para os responsáveis.
Se o item é cancelado ou concluído sem sucesso, o ramo fica interrompido e a execução aparece como "interrompida", com opção de retomar manualmente.

## 4. Acompanhamento da execução

- Aba **Execuções** no painel lateral: por fluxo/processo, com barra de progresso (etapas concluídas / total) e timeline mostrando concluídas, atual e futuras.
- Clique numa etapa já criada abre o mesmo painel de edição de item usado no Painel de Controle (`EdicaoItemPanel` + `AgendaItemRow`), permitindo mudar situação, comentar e ver atividades sem sair da tela.
- No painel lateral do processo, os itens de workflow ganham um selo com o nome do fluxo e a etapa (ex.: "Atender Cliente Banco · 2/8").

## Detalhes técnicos

Banco (novas tabelas em `public`, com GRANTs e RLS por coordenação, seguindo o padrão de isolamento já vigente):
- `workflows`: nome, descricao, coordenacao_id, ativo, criado_por, timestamps.
- `workflow_etapas`: workflow_id, ordem, titulo, tipo_item (`prazo|tarefa|audiencia|evento|parcelamento`), tipo_prazo (`corridos|uteis`), dias_previsto, dias_fatal, prioridade, descricao, exibir_kanban, regra_responsavel (`predefinido|anterior|iniciador`), condicao (`inicio|apos_etapa`), etapa_anterior_id.
- `workflow_etapa_responsaveis` / `workflow_etapa_envolvidos`: usuário por etapa.
- `workflow_execucoes`: workflow_id, processo_id, coordenacao_id, iniciado_por, data_inicio, status (`em_andamento|concluida|interrompida`).
- `workflow_execucao_etapas`: execucao_id, etapa_id, item_id (FK para o item criado), status, datas calculadas.

Encadeamento: trigger `AFTER UPDATE` sobre a tabela de itens (`tarefas` e tabelas de audiência/evento/parcelamento conforme o tipo) que, ao detectar conclusão com sucesso de um item ligado a `workflow_execucao_etapas`, cria as etapas dependentes reutilizando as funções de criação de item já existentes e replicando etiquetas do processo. Cálculo de dias úteis reaproveita `calcular_primeiro_dia_util` e a regra CLT Art. 775-A.

Frontend: nova página `src/pages/Workflow.tsx` + componentes em `src/components/workflow/` (lista, editor de etapas inline, timeline de prévia, painel de execuções), hooks `useWorkflows`, `useWorkflowEtapas`, `useWorkflowExecucoes`. Item de menu "Workflow" logo abaixo de Painel de Controle, visível a admin/coordenador/assistente coordenador. Painéis laterais reutilizam `EdicaoItemPanel` e `AgendaItemRow` para manter o layout idêntico ao Painel de Controle. Invalidação de cache com `await invalidateQueries` antes de fechar painéis.
