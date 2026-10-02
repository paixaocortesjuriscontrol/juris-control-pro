# Prazos da Mayara: duplicação e filtro por responsável/envolvido

## O que encontrei
- **Duplicação: não procede no cadastro.** Desde 17/09 a Mayara Gonçalves (Coordenação Dra. Beatriz Costa) criou 8 itens, nenhum repetido. Em 01/10 ela cadastrou 4 prazos em 2 processos. Em cada processo são dois prazos diferentes: "Juntada de carta de preposição..." e "Apresentação de quesitos...". Se a Jéssica vê um item repetido na tela, preciso de um print ou do número do processo.
- **Filtro: procede.** Nesses prazos a Mayara aparece como **envolvida**. A responsável principal é a Ana Júlia ou a Beatriz, com vários corresponsáveis. Hoje o Painel não carrega os envolvidos dos prazos e tarefas, só os de eventos e audiências. Por isso:
  - quem filtra pela Mayara em "Responsáveis" não vê os itens em que ela só está envolvida;
  - o filtro "Estou envolvido" não mostra nenhum prazo nem tarefa.

## O que será feito
1. O Painel passa a buscar os envolvidos de cada prazo e tarefa, junto com os responsáveis.
2. Ao escolher uma pessoa em "Responsáveis", entram os itens em que ela é responsável, corresponsável, criadora ou envolvida. Isso já vale para eventos e audiências.
3. "Estou envolvido" passa a funcionar também para prazos e tarefas.
4. A busca no banco também passa a trazer os itens em que a pessoa filtrada é só envolvida, para nada ficar de fora.
5. Conferência: filtrar pela Mayara deve trazer os 4 prazos de 01/10, sem repetir nenhum.

## Detalhes técnicos
- `src/hooks/useAgendaUnificada.ts`: ao lado de `tarefa_responsaveis` (~linha 721), carregar `tarefa_envolvidos` em lotes e preencher `participantes` de cada tarefa. Na montagem de `tarefaIdsPorResponsavel` (~linha 523), juntar também os `tarefa_id` de `tarefa_envolvidos` dos usuários filtrados, no mesmo período.
- `PainelControle.tsx` (linhas ~1292-1318 e ~2090-2110): o filtro já usa `participantes`, então passa a funcionar sem mudar a regra.
