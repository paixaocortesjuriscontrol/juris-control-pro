# Kurier e DJEN Pautas: achar a pauta e entregar a todas as coordenações certas

## Por que não apareceu para a Dra. Janaina
- O DJEN Servidor consulta só o DJEN. As pautas de julgamento dos TRTs saem no DEJT (Diário Eletrônico da Justiça do Trabalho), que é outro diário.
- O DJEN Pautas lê o DEJT, mas procura só o termo principal ("REDE D'OR SAO LUIZ"), ignora os termos alternativos e compara com o apóstrofo. Na pauta está "REDE DOR".
- O Kurier lê vários diários, inclusive o DEJT, e trouxe a pauta. Mas também compara com o apóstrofo e entrega a publicação só para a primeira coordenação cujo termo bate (aqui, a GOL, pelo termo do Dr. Osmar).

## O que será feito
1. DJEN Pautas: usar também os termos alternativos e ignorar apóstrofos e pontuação ao comparar.
2. Kurier: ignorar apóstrofos e pontuação ao comparar termos de parte e de advogado.
3. Kurier: entregar a publicação a todas as coordenações cujo termo bater, e não só à primeira, sem gravar repetida na mesma coordenação.
4. Recuperar a pauta de 05/11 do processo 0000078-28.2026.5.10.0018 na Coordenação Dra. Janaina Catunda, como não lida.
5. Procurar outras publicações do Kurier desde 01/10/2026 que deixaram de chegar a alguma coordenação por esses motivos, entregá-las e gerar um relatório por coordenação.
6. Testes automáticos: "REDE D'OR SAO LUIZ" deve bater com "REDE DOR SAO LUIZ", e uma publicação que bate com duas coordenações deve ir para as duas.

## Detalhes técnicos
- DJEN Pautas: `executar-djet-pautas-agendado/index.ts` passa a selecionar `termos_or` e incluí-los em `monitToInput`; o `normalize` de `buscar-dejt-pautas` remove ' ’ ` e pontuação.
- Kurier: normalização em `supabase/functions/_kurier-shared/djenMatch*.ts`; em `kurier-consultar-publicacoes/index.ts`, trocar o `break` do primeiro match por uma lista de matches, com uma inserção por `coordenacao_id` e a mesma deduplicação `coord|hash`.
- A recuperação reprocessa `kurier_publicacoes_raw` do período com a nova regra e só insere o que falta; nunca altera nem apaga o que já existe.
