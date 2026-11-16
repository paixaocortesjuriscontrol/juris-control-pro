# DJEN Servidor: TST sem publicações hoje (16/11/2026)

## O que foi confirmado
- O DJEN Servidor rodou hoje às 04h30, 06h00 e 07h30. Tudo indica que nenhuma rodada rodou no sábado nem no domingo.
- Na rodada das 04h30, a busca do TST falhou: 38 erros de conexão ("fetch failed") e cerca de 80 bloqueios temporários do DJEN (403) nas VPS. As buscas do TST trouxeram 0 publicações novas e 0 duplicadas, ou seja, não chegaram a ler nada.
- Por isso estão zeradas as coordenações que dependem do TST pelo DJEN: Dra. Renata Oficial, Dra. Vanessa Gomes TST, JOMAGA/AVIANCA, Santander Trabalhista e Citibank. As 914 publicações do TST que entraram hoje vieram pelo Kurier, não pelo DJEN Servidor.
- As rodadas das 06h00 e 07h30 foram rápidas e não repetiram o TST.

## O que fazer
1. Às 08h08, o site do Comunica PJe não respondeu e a consulta das publicações foi recusada (bloqueio 403). Assim que ele voltar, rodar uma repescagem só do TST para o dia 16/11/2026, sem esperar a rodada das 10h00.
2. Depois que ela terminar, conferir quantas publicações entraram em cada coordenação, comparando com sexta (13/11).
3. Se os bloqueios 403 continuarem, distribuir os termos do TST entre as outras VPS e aumentar a espera entre as tentativas, que já está prevista.
4. Corrigir a regra que considera a busca "concluída" quando todas as tentativas do TST falham, para que esse tipo de falha conte como pendente e entre automaticamente na próxima repescagem.

## Detalhes técnicos
- Execução 4c8feb18 (04h30 BRT): os cartões parte, palavra-chave e processo do TST tiveram erro, mesmo com o lote marcado como concluído.
- O item 4 muda o checkpoint (`unidadesConcluidas`) para não incluir uma unidade quando todas as consultas dela falharam.
