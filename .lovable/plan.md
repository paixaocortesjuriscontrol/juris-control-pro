# Atividades pré-definidas nas etapas do Workflow

Hoje cada etapa do workflow gera um item (Tarefa, Prazo, Audiência, Evento ou Parcelamento). A ideia é permitir que, ao montar o workflow, você já cadastre a lista de **Atividades** (subatividades) de cada etapa — e elas nasçam automaticamente dentro do item quando a etapa é criada.

## Como vai funcionar

1. No editor do workflow, ao criar/editar uma etapa, aparece um bloco **Atividades desta etapa**:
   - campo de título + botão adicionar;
   - para cada atividade: responsável (escolhido individualmente, com opção "Herdar da etapa") e observação opcional;
   - reordenar e remover itens da lista.
2. Ao iniciar o fluxo (ou ao a etapa ser materializada), depois de criar a tarefa/prazo/audiência/evento, o sistema grava cada atividade vinculada a esse item:
   - **data prevista = a mesma data prevista do item da etapa**;
   - situação inicial "Pendente";
   - responsável: o definido na atividade; se ficou como "Herdar", usa o responsável principal da etapa.
3. As atividades aparecem normalmente na aba Atividades do formulário do item, no calendário do Painel de Controle e na agenda, como qualquer atividade criada à mão.
4. Workflows existentes continuam funcionando: etapa sem atividades cadastradas gera o item sem nenhuma atividade.

## Detalhes técnicos

- Nova tabela `public.workflow_etapa_atividades`: `id`, `etapa_id` (FK `workflow_etapas`, on delete cascade), `ordem`, `titulo`, `responsavel_id` (nullable = herdar), `observacao`, `created_at`, `updated_at`, com GRANTs (`authenticated` CRUD, `service_role` ALL), RLS espelhando as políticas atuais de `workflow_etapas` (acesso pela coordenação do workflow) e trigger de `updated_at`.
- `src/hooks/useWorkflows.ts`: hooks `useWorkflowEtapaAtividades(etapaId)` / `useWorkflowEtapasAtividades(workflowId)` (mapa etapa → atividades) e mutação de salvar em lote (delete + insert por etapa), invalidando as queries do editor.
- `src/components/workflow/WorkflowEditor.tsx`: bloco de atividades no diálogo da etapa (estado local no `form.atividades`), salvo junto com a etapa em `createEtapa`/`updateEtapa`; badge no card da etapa mostrando "N atividades".
- `src/lib/workflowExecutor.ts`: após `criarItemWorkflow` retornar `{ id, tipo }`, ler as atividades da etapa e inserir em `subatividades_item` com `tipo_item` = tipo do item em minúsculo (`tarefa`/`prazo`/`evento`/`audiencia`/`parcelamento`), `item_id` = id criado, `data_prevista` = a data prevista calculada da etapa, `situacao: "pendente"`, `responsavel_id` = atividade ou responsável principal, `criado_por` = usuário. Falha ao inserir atividades não derruba a criação da etapa (log + segue).
