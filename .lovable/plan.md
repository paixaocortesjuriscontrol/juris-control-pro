# Minhas Responsabilidades com cara e filtros do Painel de Controle

## Como está hoje
- A barra de filtros do Painel já aparece, mas várias opções não fazem efeito: escolher tipo de atividade (por exemplo Audiência) não muda a lista, que foi a queixa da Isabela.
- A aba Atividades é uma lista simples de cartões, sem os modos de exibição, cores de situação, seleção nem exportação que existem no Painel.

## O que muda
1. **Mesmo topo do Painel**: filtros completos (tipos, situações, período por data prevista/fatal/publicação, comentários, cobranças, origem DJ, sem vínculo, coordenação, etiquetas, modelo de tarefa), com busca por número, parte ou título e o contador "X de Y itens filtrados".
2. **Cartões de resumo clicáveis**: Hoje, Atrasadas, Esta semana, Pendentes e Concluídas. Clicar num cartão já filtra a lista.
3. **Mesmos modos de exibição do Painel**: Lista profissional em três linhas (processo/tipo, título/datas, assunto e observação), Kanban e Calendário, com a cor de cada tipo e a situação colorida ("A confirmar" azul etc.).
4. **Ações do Painel**: seleção múltipla para mudar a situação em lote, exportar para Excel o que está filtrado e abrir o item no painel lateral. Remanejar só para quem já pode no Painel.
5. **Abas Processos e Workflows** no mesmo padrão: tabela com filtros, busca e link do processo abrindo em outra aba.
6. Os filtros escolhidos ficam guardados por usuário ao sair e voltar.

## O que não muda
- Quem aparece continua igual: só itens em que a pessoa é responsável ou envolvida. Admin ainda pode escolher "ver de outra pessoa".
- Nenhuma permissão nem regra de datas é alterada.

## Detalhes técnicos
- `src/pages/MinhasResponsabilidades.tsx`: aplicar o filtro `tipo`/classificações a todas as fontes, incluindo audiências; substituir a lista de cartões por `ListaAtividadesView`, `KanbanItensAgenda` e a visão de calendário usadas em `PainelControle.tsx`, alimentadas pelos mesmos itens já carregados (`lerFonteAgendaPorTipo`).
- Reaproveitar `ExportarAtividadesDialog`, a ação de situação em lote do Painel e `PainelFiltros` sem `ocultarResponsaveis` para os filtros que hoje ficam escondidos.
- Persistir `PainelFiltrosState` em localStorage com chave por usuário.
- Sem mudança no banco.
