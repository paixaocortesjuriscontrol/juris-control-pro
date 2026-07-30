## Objetivo

No fluxo "Criando item a partir da publicação selecionada" (Análise DJEN), permitir clicar em qualquer linha do card verde "Itens criados a partir desta publicação" e abrir o formulário do item já preenchido para edição, sem sair da tela.

## Comportamento

- Cada linha do card verde vira um botão (cursor pointer, hover destacado, acessível por teclado).
- Ao clicar: o formulário de criação atualmente aberto é fechado e, no mesmo lugar, abre o formulário de **edição** do item clicado, com os dados carregados.
- Ícone/ação visual de "editar" à direita da linha.
- Ao salvar ou fechar a edição, volta ao estado anterior (card verde visível + botão "+ Adicionar"), com a lista de itens atualizada.

## Alterações técnicas

1. `src/components/shared/ItensCriadosPublicacaoCard.tsx`
   - Nova prop opcional `onSelecionarItem?: (item: ItemCriado) => void`.
   - Quando fornecida, cada linha é renderizada como `<button>` com hover/focus e ícone `Pencil`; sem a prop, comportamento atual (somente leitura) é mantido.

2. `src/pages/AnaliseDjen.tsx`
   - Novo estado `itemEmEdicao: { tipo, id } | null`.
   - Handler `abrirEdicaoItem(item)`: fecha os forms de criação (`criarTarefaDialogOpen`, `novoEventoOpen`, `novoPrazoOpen`, `novaAudienciaOpen`) e seta `itemEmEdicao`.
   - Carregamento do registro por tipo (mesmo padrão de `EdicaoItemPanel`):
     - `tarefa`/`prazo` → `tarefas` por id;
     - `evento` → `eventos_agenda` por id;
     - `audiencia` → `audiencias_detectadas` por id.
   - Renderização inline do form de edição conforme o tipo, reaproveitando os componentes já usados na página, no modo `inline`:
     - `PrazoDialog` (prazo), `EventoDialog` (evento), `NovaTarefaDialog` (tarefa, com `tarefaParaEditar`), `EditarAudienciaDialog` (audiência).
   - `onOpenChange(false)` → limpa `itemEmEdicao` e invalida as queries relevantes (`itens-existentes-publicacao`, `agenda-unificada`, `tarefas`) antes de voltar ao card.
   - O wrapper permanece aberto enquanto houver `itemEmEdicao` (incluir na condição `wrapperAberto`), e `fecharTudo` também limpa esse estado.
   - Passar `onSelecionarItem={abrirEdicaoItem}` para `ItensCriadosPublicacaoCard`.

Sem mudanças de banco de dados ou Edge Functions.
