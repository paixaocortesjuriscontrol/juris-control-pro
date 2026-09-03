# Abrir a tarefa em painel sobreposto (drawer) no Painel de Controle

Hoje, ao clicar num item do Painel de Controle, o formulário da tarefa ou substitui todo o conteúdo da tela (Kanban, Equipe, Alertas) ou empurra o calendário para o lado. O protótipo enviado usa outra abordagem: a lista continua visível ao fundo, escurecida, e o detalhe entra deslizando pela direita, com cabeçalho escuro fixo e conteúdo em blocos.

## O que muda

- Clicar num item passa a abrir um painel sobreposto que desliza da direita, com fundo escurecido sobre a tela atual.
- A lista/kanban/calendário permanece visível atrás, sem recarregar nem perder rolagem, filtros ou página.
- Fechar por: botão X no cabeçalho, tecla Esc ou clique fora do painel.
- Cabeçalho fixo no topo do painel (azul-marinho, no padrão do protótipo) com o título do item, o número do processo e as ações principais sempre à vista, mesmo rolando o formulário.
- Largura confortável em desktop (cerca de 720px) e tela cheia no celular.
- Vale para os quatro modos onde hoje o formulário toma a tela: Agenda, Kanban, Equipe e Alertas. Mesmo comportamento para o painel de "Novo item" e para o painel do dia.

## O que não muda

- Nenhuma regra de negócio, campo, validação, permissão ou consulta. É só a forma de exibir o formulário que já existe.

## Detalhes técnicos

- Novo componente `src/components/agenda/ItemDrawer.tsx`: overlay + painel lateral com animação, baseado no `Sheet` do shadcn já presente no projeto (`src/components/ui/sheet.tsx`), com cabeçalho escuro e área de conteúdo rolável.
- Em `src/pages/PainelControle.tsx`, remover as ramificações `selectedItem ? (...) : (...)` dos modos kanban, equipe e notificações (linhas ~2577, 2597, 2627) e o `<aside>` do modo agenda (~2882): a lista passa a renderizar sempre e o `EdicaoItemPanel` / `NovoItemPanel` são montados dentro do `ItemDrawer`, controlados pelos mesmos estados `selectedItem` e `novoItemTipo`.
- `EdicaoItemPanel` continua igual; apenas o cabeçalho próprio dele cede lugar ao cabeçalho do drawer para evitar dois títulos.
- Cores via tokens do design system (sem valores fixos), acompanhando o tema atual do app em vez do azul da CAIXA do protótipo.
- Sem alterações de banco, hooks ou edge functions.
