# Por que o Kurier achou o processo 0024421-89.2025.5.24.0000 e o DJEN Servidor não

## O que já conferi na base

- A publicação (DJEN nº 765892809, TRT24, disponibilizada em 23/10/2026) entrou **só pelo Kurier** (login paixaoc, às 07h12 de Brasília). Não existe em nenhuma coordenação pelo DJEN Servidor nem nas descartadas.
- O termo que deveria pegar existe: **Coordenação Dr. Thomás — advogado OSMAR MENDES PAIXAO CORTES, com "BRADESCO" obrigatório**, TRT24 incluído. O texto da publicação tem os dois (Osmar OAB 15553/DF e Banco Bradesco).
- O DJEN Servidor rodou três vezes em 23/10 (01h30, 10h00 e 17h00 de Brasília). Nenhuma falha registrada para TRT24 nesse termo — ou seja, a busca rodou e não trouxe ou não validou essa publicação.
- **Erro no cadastro do termo:** a variação extra está como `310314/OSMAR MENDES PAIXAO CORTES`. 310314 não é a OAB do Dr. Osmar (é 15553/DF). A busca por essa OAB não traz nada dele.
- O mesmo termo da Dr. Thomás com "VILLAGGIO PARK" tem o mesmo erro.

## Causa (a confirmar no passo 1)

Hipóteses, em ordem de probabilidade:
1. A busca por nome no TRT24 não trouxe essa página, e a busca complementar por OAB usou 310314 (errada) em vez de 15553/DF.
2. A busca trouxe, mas a validação descartou sem gravar (ex.: o "BRADESCO" obrigatório só olhando parte do texto).
3. A publicação entrou na API do DJEN depois das rodadas (menos provável: a das 10h00 já deveria pegar).

## Passos

1. Consultar a API do DJEN por uma VPS do pool, para TRT24 em 23/10: por nome do advogado, por OAB 15553/DF e por 310314. Ver qual traz a 765892809 e simular a validação do termo.
2. Corrigir o que o passo 1 apontar:
   - cadastro: trocar 310314 por 15553 nos dois termos da Coordenação Dr. Thomás (só a OAB; nada mais muda);
   - se a validação estiver descartando, ajustar a regra do motor Servidor para olhar o texto completo e os advogados estruturados;
   - se for paginação, ajustar a busca do motor.
3. Reprocessar 23/10 para TRT24 nesse termo e confirmar que a publicação aparece na Coordenação Dr. Thomás.
4. Varrer outros termos com OAB divergente entre o campo OAB e a variação extra, e listar para você antes de mexer.

## Detalhes técnicos

- Termos: `monitoramentos_djen` ids `18e5c1db…` (BRADESCO) e `c8c9d791…` (VILLAGGIO), `oab=15553`, `termos_or=['310314/OSMAR MENDES PAIXAO CORTES']`.
- Motor: `monitor-servidor/engines/paralela.js` (`parsearTermoOr`, suplemento por OAB, `contemTermo` + concomitante).
- Reprocessamento via `enfileirar_execucao_servidor` só para TRT24/23-10.
