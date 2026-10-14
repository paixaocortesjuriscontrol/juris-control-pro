# Retirar os 3 prazos fatais de 03/10/2026 da Coordenação Dra. Renata Oficial

## O que será feito
Apagar só a data de **Prazo fatal** (03/10/2026) da ficha destes 3 processos:
- 0101983-72.2016.5.01.0052
- 0002584-95.2015.5.02.0046
- 1000475-17.2022.5.02.0056

Depois disso, os 3 itens **[PRAZO FATAL]** somem do Painel de controle.

## O que não muda
- Os processos continuam cadastrados, com dossiê, equipe e o restante da ficha.
- Os demais prazos fatais da coordenação ficam como estão, inclusive os dos dias 02/09, 02/11 e 02/12.
- Tarefas, prazos e eventos criados por alguém também não mudam.

## Detalhes técnicos
- Atualização de dados (sem mudança de estrutura): `processos.data_fatal = NULL` nos IDs `9cde1e48-67e3-4244-8d04-9d8d611ae0e8`, `4745ef12-ab31-42c8-b7db-904c1aea91ef` e `dc429061-49e4-4e63-b8eb-b29f88e3c0ee`.
- A atualização vale só para `coordenacao_id = b0f690ad-68da-43d7-af5f-9adafeab3fd5` e `data_fatal = '2026-10-03'`.
- Ao final, conferir que as 3 linhas foram alteradas.
