# Ver a agenda de outra pessoa no Painel (reclamação da Júlia / Dra. Janaina)

## O que foi conferido
- Júlia Rocha (assistente, Coordenação Dra. Janaina Catunda) tem permissão de ver **todas as 1.090 tarefas** da coordenação em out–nov/2026 (nenhuma bloqueada pelo banco).
- O filtro "Responsáveis" aparece para todos os perfis.
- O problema está na aba **Pessoal**: ela sempre busca só os itens da própria pessoa logada. Quando a Júlia escolhe outra pessoa no filtro, a tela filtra em cima da agenda *dela* — e sobra vazio, a menos que ela também esteja na tarefa.
- Na aba **Escritório** o filtro por pessoa já funciona (busca o mês inteiro da coordenação e depois filtra).

Ou seja: a reclamação procede na aba Pessoal.

## O que vai mudar
- Na aba **Pessoal**, ao escolher uma pessoa em "Responsáveis", o painel passa a mostrar a agenda **daquela pessoa** (responsável, co-responsável, envolvida, participante), como no Astrea.
- Escolhendo várias pessoas, mostra a soma das agendas delas.
- Sem ninguém escolhido, continua mostrando a própria agenda.
- Quem pode ver o quê continua decidido pelo banco: só aparecem itens das coordenações que a pessoa logada já pode ver. Nenhuma permissão muda.

## Detalhes técnicos
- `PainelControle.tsx` (memo `filters`): no modo pessoal, usar `painelFiltros.responsavelIds` sempre que houver seleção (hoje só em Protocolados/Baixados); incluir na chave da consulta.
- `resolverModoBuscaAgenda`: 1 pessoa → `get_agenda_pessoal(p_usuario = escolhida)` (SECURITY INVOKER, RLS aplica); várias → já cai na consulta legada por pessoas.
- Cartões totalizadores com filtro de pessoa já usam a agenda carregada (sem RPC de totais), então acompanham.
- Teste em `agendaModoBusca.test.ts`: pessoal com pessoa escolhida usa o ID dela, não o do usuário logado.
- Atualizar regra no `AGENTS.md`. Sem migração no banco.
