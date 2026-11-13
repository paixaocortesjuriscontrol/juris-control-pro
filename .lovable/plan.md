# Filtro por modelo de tarefa no Painel de Controle

## Objetivo
Permitir que o colaborador da Santander Cível (e de qualquer coordenação) encontre primeiro as tarefas mais relevantes, como "Simulador 1ª fase" e "Simulador 2ª fase", sem rolar as 55 tarefas.

## O que muda para o usuário
1. **Novo filtro "Modelo da tarefa"** dentro do botão Filtros (Painel de Controle e Minhas responsabilidades):
   - Lista com busca dos modelos de tarefas da coordenação (os mesmos da tela Modelos de tarefas), com a cor de cada um.
   - Pode marcar vários (ex.: Simulador 1ª fase + Simulador 2ª fase).
   - Mostra só as tarefas criadas a partir desses modelos.
2. **Filtro "Título contém"**: campo de texto no mesmo painel (ex.: digitar "simulador") para achar também tarefas cadastradas sem modelo, mas com o nome no título.
3. **Filtros salvos por pessoa**: o último filtro escolhido fica guardado para aquele usuário, para ele não precisar marcar de novo todo dia.
4. A planilha gerada do Painel respeita esses filtros, como já acontece com os outros.

## Fora do escopo
- Não muda contagens dos cartões de resumo além do que os outros filtros já fazem.
- Não altera permissões nem dados.

## Detalhes técnicos
- `PainelFiltrosState`: novos campos `modeloIds: string[]` e `tituloContem: string`, com padrão vazio.
- `PainelFiltros.tsx`: seção com combobox multisseleção (modelos ativos de `modelos_titulo_coordenacao` das coordenações do escopo, deduplicados por nome) e input de texto.
- Filtro aplicado no cliente em `PainelControle.tsx` e `MinhasResponsabilidades.tsx`, usando a leitura já existente de `tarefas.modelo_tarefa_id` por período (sem mudar as RPCs da agenda); título comparado sem acento e sem maiúsculas.
- Persistência por usuário em localStorage (`painel-filtros:<userId>`), apenas preferência de tela.
- Testes da função de filtro (modelo e título) junto aos testes existentes.
