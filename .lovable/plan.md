# Kurier: entregar a publicação a todas as coordenações certas

## Por que o Kurier achou e o DJEN Servidor não
- O DJEN Servidor consulta só o DJEN (Diário de Justiça Eletrônico Nacional, do CNJ). As pautas de julgamento dos TRTs saem no DEJT (Diário Eletrônico da Justiça do Trabalho), que é outro diário e não aparece no DJEN.
- O Kurier é um serviço pago que lê vários diários, inclusive o DEJT, e entrega as publicações de cada login do escritório. Por isso só ele trouxe a pauta de 05/11.
- O Kurier trouxe a publicação, mas ela não chegou à Dra. Janaina por dois motivos: a comparação do termo leva o apóstrofo em conta ("REDE D'OR" não é igual a "REDE DOR"), e a publicação vai só para a primeira coordenação cujo termo bate (aqui, a GOL, pelo termo do Dr. Osmar).

## O que será feito
1. No Kurier, ignorar apóstrofos e pontuação ao comparar termos de parte e de advogado.
2. Entregar a publicação a todas as coordenações cujo termo bater, e não só à primeira, sem gravar repetida na mesma coordenação.
3. Recuperar a publicação de 05/11 do processo 0000078-28.2026.5.10.0018 na Coordenação Dra. Janaina Catunda, como não lida.
4. Procurar outras publicações do Kurier desde 01/10/2026 que deixaram de chegar a alguma coordenação por esses dois motivos, entregá-las e gerar um relatório por coordenação.
5. Teste automático: "REDE D'OR SAO LUIZ" deve bater com "REDE DOR SAO LUIZ", e uma publicação que bate com duas coordenações deve ir para as duas.

## Detalhes técnicos
- Normalização em `supabase/functions/_kurier-shared/djenMatch*.ts` (remover ' ’ ` e pontuação antes de comparar).
- Em `kurier-consultar-publicacoes/index.ts`, no laço de candidatos, trocar o `break` do primeiro match por uma lista de matches, com uma inserção por `coordenacao_id` e a mesma deduplicação `coord|hash`.
- A recuperação reprocessa `kurier_publicacoes_raw` do período com a nova regra, só inserindo o que falta (nunca altera nem apaga o que já existe).
