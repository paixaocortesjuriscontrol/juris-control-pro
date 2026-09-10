# Opção de processo vinculado por Workflow

Hoje o campo de processo ao iniciar um Workflow é sempre opcional, e os itens criados sem processo não aparecem no Painel de Controle filtrado por processo. A ideia é que **cada workflow decida** se exige processo ou não.

## Como vai funcionar

1. **No editor do workflow** (tela Workflows, ao criar/editar um fluxo), aparece uma nova opção:
   - **"Exigir processo vinculado ao iniciar"** (liga/desliga), ao lado do nome e descrição do fluxo.
2. **Na tela de Iniciar Workflow** (e no formulário inline do Painel de Controle / Detalhe do Processo):
   - Se o workflow tem a opção **ligada**: o campo de busca de processo passa a ser obrigatório, com validação bloqueando o botão "Iniciar execução" até escolher um processo.
   - Se a opção está **desligada**: comportamento atual (opcional), com um lembrete visual de que os itens ficarão sem vínculo de processo.
3. Workflows já existentes continuam com a opção **desligada** (nada muda para quem já usa).

## Detalhes técnicos

- Migração: `ALTER TABLE public.workflows ADD COLUMN requer_processo boolean NOT NULL DEFAULT false;`
- `src/hooks/useWorkflows.ts`: incluir `requer_processo` no tipo e nas mutações de criar/atualizar workflow.
- `src/components/workflow/WorkflowEditor.tsx`: switch/checkbox "Exigir processo vinculado ao iniciar" no formulário do fluxo, salvo junto com nome/descrição.
- `src/components/workflow/IniciarWorkflowDialog.tsx`: ler `requer_processo` do workflow selecionado; quando `true`, o label vira "Processo *" e `handleSubmit` bloqueia com toast caso não haja processo selecionado. Quando `false`, manter "(opcional)" com texto de ajuda explicando que sem processo os itens não aparecem vinculados a um processo no Painel de Controle.
- Sem alteração no executor nem em execuções já criadas.
