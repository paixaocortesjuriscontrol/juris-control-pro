# Filtro "Atividades da minha agenda" no Painel de Controle

## Objetivo
O colaborador encontra primeiro o que é prioridade (ex.: Defesas, depois Recursos como Apelação e Recurso inominado, Simulador 1ª/2ª fase) dentro da **sua própria agenda do dia ou período escolhido**, sem uma lista genérica com todos os modelos cadastrados.

## Como vai funcionar
1. No Painel de Controle (e em Minhas responsabilidades) aparece uma faixa **"Atividades na agenda"** logo acima da lista.
2. Ela lê os itens que estão na tela naquele momento (dia/período, pessoa e demais filtros já aplicados) — **tarefas e prazos** — e mostra só os nomes que realmente existem ali, cada um com a quantidade. Exemplo:
   `Defesa (70)  Recurso – Apelação (18)  Recurso inominado (12)  Manifestação (25)`
3. Nomes ordenados pela quantidade (os mais frequentes primeiro), com campo de busca quando houver muitos.
4. Clicar em um ou mais nomes mostra só essas atividades; clicar de novo desmarca. Botão "Limpar".
5. Ao mudar o dia ou a pessoa, a lista de nomes se refaz sozinha com a agenda nova; nomes que não existem mais saem da seleção.
6. O nome usado é o **modelo da atividade** parametrizado na coordenação (ex.: Santander Cível); quando o item não tem modelo, usa o título dele.
7. Vale para qualquer colaborador e qualquer coordenação; a planilha do Painel segue a mesma seleção.

## Ajustes adicionais
8. **Visão Lista mostra só o dia selecionado**: ao clicar em Lista, aparecem apenas os itens do dia escolhido (não o mês inteiro); as setas avançam/voltam um dia.
9. **"Tipo de tarefa" dentro do botão Filtros**: a mesma escolha de atividades (com as quantidades da agenda carregada) também fica como seção no painel Filtros, sincronizada com a faixa acima da lista.

## Fora do escopo
- Não muda permissões, dados, nem os cartões de contagem.

## Detalhes técnicos
- Nova função pura `agruparAtividadesDaAgenda(itens, modeloPorTarefa)` em `src/lib/` que devolve `{chave, nome, cor, quantidade}`; chave = `modelo_tarefa_id` ou título normalizado (sem acento/maiúsculas).
- Usa a leitura já existente de `tarefas.modelo_tarefa_id` por período no `PainelControle.tsx` (sem mudar RPCs da agenda); inclui tipos tarefa e prazo.
- Novo campo `atividadesSelecionadas: string[]` no estado de filtros, aplicado no cliente depois dos filtros atuais; a contagem de chips é feita antes desse filtro para não sumirem opções.
- Componente `AtividadesDaAgendaChips.tsx` reutilizado nas duas telas.
- Lista: `PainelControle.tsx` filtra por `selectedDate` quando `viewMode === "lista"` e a navegação usa passo diário nessa visão.
- `PainelFiltros.tsx` recebe as opções agrupadas via prop e edita `atividadesSelecionadas`.
- Testes da função de agrupamento e do filtro junto aos testes existentes.
