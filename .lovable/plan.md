# Acompanhamento Especial: está rodando, mas lendo dados antigos

## O que foi conferido (23/10/2026, 09h BRT)
- 55 processos marcados com Acompanhamento Especial.
- As checagens de 10h, 14h e 18h e a repescagem a cada 3 min rodam todos os dias úteis, sem falhas.
- Só 2 ou 3 processos dão erro "sem dados na Judit".
- **Problema:** nos últimos 3 dias, as 191 consultas usaram só a cópia guardada pela Judit, nunca uma busca nova no tribunal. A movimentação mais recente nessa cópia é de 02/10/2026. Por isso nenhuma novidade aparece desde 19/10 e ninguém recebeu aviso nos últimos 7 dias.

## Correção proposta
1. Na checagem das 10h, pedir à Judit uma **busca nova no tribunal** para cada processo, em vez de aceitar a cópia guardada. Nos horários de 14h e 18h, fazer o mesmo para os processos configurados para 2x ou 3x ao dia.
2. Usar a cópia guardada só se a busca nova falhar ou demorar demais.
3. Registrar em cada consulta se o dado veio de busca nova ou da cópia, com a data da última movimentação, para que esse problema apareça logo.
4. Manter a repescagem só para quem ficou pendente na rodada, sem gastar créditos com processos já checados.
5. Rodar uma checagem manual e confirmar que aparecem movimentações posteriores a 02/10.

## Custo
Cada busca nova consome créditos Judit: cerca de 55 por dia com 1x ao dia, e mais para quem está configurado para 2x ou 3x.

## Detalhes técnicos
- `judit-acompanhamento-especial/index.ts`: hoje faz `GET /lawsuits/{cnj}` e só chama `juditCrawler` (POST /requests, `cache_ttl_in_days: 0`) quando o cache vem vazio. A ordem passa a ser crawler primeiro, com o cache como alternativa quando dá timeout ou erro. O orçamento de tempo por invocação deve ser respeitado (a repescagem continua os pendentes).
- `consultas_judit.payload_resposta.origem_dado` já existe; adicionar a idade do último step.
- Sem mudanças no banco.
