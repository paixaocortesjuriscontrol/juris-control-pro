# DJEN Pautas: não perder tribunais por "Rate limit exceeded"

## O que aconteceu
Na busca de 05/11 a 06/11, iniciada às 18:18, o TST e os TRT1 a TRT14 terminaram normalmente. Do TRT15 ao TRT24, todos falharam com "Rate limit exceeded for trace ...".

Esse aviso não vem do site do DEJT. Ele vem do nosso servidor. A busca de pautas chama a função de leitura do caderno uma vez para cada tribunal, dia e trecho de páginas. Todas essas chamadas fazem parte da mesma execução. Quando passam de um limite por minuto, o servidor manda esperar alguns segundos ("Retry after 21696ms", ou seja, cerca de 22 segundos).

Hoje o sistema não espera. Ele marca o tribunal como erro e segue para o próximo, que também falha. Por isso os 10 últimos tribunais caíram em sequência.

## Correção
1. Quando vier esse aviso, o sistema espera o tempo indicado e tenta de novo o mesmo trecho, sem marcar erro. São até 5 tentativas, com espera máxima de 60 segundos cada.
2. Entre um trecho de páginas e o próximo, fazer uma pausa curta de cerca de 300 ms, para não chegar ao limite tão rápido em buscas de vários dias.
3. Enquanto espera, o cartão do tribunal mostra "Aguardando liberação do servidor (Xs)", e não erro.
4. Rodar de novo a busca de 05/11 a 06/11, para recuperar o TRT15 a TRT24, e conferir que todos terminam.

## O que esperar
- A busca pode demorar um pouco mais quando houver esperas, mas não perde mais tribunais.
- O resultado dos tribunais que já terminaram não muda.

## Detalhes técnicos
- `supabase/functions/executar-djet-pautas-agendado/index.ts`, no laço de retry do `fetch` para `buscar-dejt-pautas`: tratar `resp.status === 429` (ou corpo com "Rate limit exceeded") como transitório. Ler `Retry after (\d+)ms` do corpo ou o header `Retry-After`, esperar esse tempo mais 500 ms (teto de 60 s), até 5 tentativas próprias, separadas das 3 tentativas de erros 5xx.
- Durante a espera, atualizar `item.mensagem` e chamar `flushProgresso`. Antes de esperar, checar o cancelamento.
- Pausa de 300 ms entre chunks (`CHUNK_PAGES`) e entre dias.
- Deploy da função e nova execução manual de 05/11 a 06/11, conferindo em `execucoes_agendadas.detalhes.progresso` que nenhum item termina em `erro`.
