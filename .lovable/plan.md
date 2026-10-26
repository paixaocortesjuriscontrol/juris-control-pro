# Por que o DJEN Servidor não achou a publicação do TRT24 em 23/10

## O que os registros mostram
- As 3 rodadas automáticas de 23/10 (04h30, 10h00 e 17h00, horário de Brasília) consultaram o TRT24 com os 18 termos de advogado. Nenhuma teve erro, e **o DJEN não devolveu nada**: 0 novas, 0 duplicadas, 0 descartadas. Nas buscas por parte e por palavra-chave, voltou só 1 publicação.
- A busca manual de hoje (26/10, 14h07), para o mesmo dia 23/10 e com os mesmos termos, trouxe **25 publicações por advogado, 22 por palavra-chave e 35 por parte**. A do Dr. Osmar estava entre elas, pelo termo "ADVOGADO + OSMAR MENDES PAIXAO CORTES".
- Em 23/10, o mesmo grupo de tribunais voltou zerado nas 3 rodadas: TRT24, TRT7, TRT8, vários TJs e TRFs.
- O Kurier pegou a publicação às 07h12 de 23/10, porque tem fonte própria.

**Conclusão:** o motor e as regras de validação funcionaram. Naquele dia, o **DJEN demorou a liberar as publicações do TRT24 na busca**. Elas só passaram a aparecer depois da última rodada das 17h00. As rodadas seguintes procuram só o dia corrente e não voltaram a olhar o dia 23/10. Por isso a publicação ficou de fora até a busca manual.

## O que será feito
1. **Repescagem automática dos dias anteriores:** uma vez por dia, de madrugada, o DJEN Servidor busca de novo os **2 dias úteis anteriores**, só nos tribunais e tipos de busca que voltaram zerados ou parciais naquele dia. As publicações já capturadas não se repetem, porque a regra de duplicidade atual continua valendo.
2. **Aviso na tela de execuções:** quando um tribunal voltar zerado para todos os termos de advogado num dia útil, ele fica marcado como "sem retorno do DJEN — será repescado". Assim fica fácil ver o que aconteceu.
3. **Conferir:** rodar a repescagem para 22/10 e 23/10 e ver se aparece alguma outra publicação perdida. A do Dr. Osmar já entrou pela busca manual e não vai duplicar.

## Detalhes técnicos
- Motor: `monitor-servidor/engines/paralela.js`, mais o agendamento em `monitor-servidor/index.js`. Novo modo "repescagem" com `dataInicio`/`dataFim` = D-2..D-1 úteis, filtrando os pares tribunal+tipo que tiveram `novas+duplicatas+descartadas = 0` ou `parcial = true` em `execucoes_servidor.progresso.itens`.
- Execução registrada como `djen_paralela_servidor` com marca de repescagem, para aparecer separada na tela de execuções.
- Nenhuma alteração no cadastro dos termos nem nas regras de validação.
