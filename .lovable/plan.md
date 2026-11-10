# DJEN Pautas em paralelo

## Objetivo
Hoje o DJEN Pautas lê um tribunal de cada vez, do TST ao TRT24. Quando chega a um caderno grande, como o TRT2, todos os outros esperam. A ideia é ler **4 tribunais ao mesmo tempo**, para a busca terminar mais rápido.

## O que muda para quem usa
- Vários cartões de tribunal ficam "executando" ao mesmo tempo, e não só um.
- Um tribunal grande (TRT2, TRT1, TRT5) não segura mais os outros.
- Cancelar, Force kill e Reset total continuam funcionando. Ao cancelar, os tribunais em andamento param no próximo dia ou trecho de páginas.
- O resultado final não muda: as mesmas publicações novas, repetidas e descartadas.

## Riscos e cuidados
- O site do DEJT pode recusar acessos em excesso. Por isso o limite é 4 de cada vez. Se surgirem muitas falhas, baixamos para 2.
- A busca inteira continua com o mesmo tempo máximo de execução no servidor. Rodar em paralelo só diminui o tempo total.

## Detalhes técnicos
- `supabase/functions/executar-djet-pautas-agendado/index.ts`: trocar o laço `for (const tribunal of TRIBUNAIS_DEJT)` por um pool de concorrência (constante `CONCORRENCIA_TRIBUNAIS = 4`). Cada worker pega o próximo tribunal de uma fila compartilhada e executa o mesmo corpo atual, que vai para uma função `processarTribunal(tribunal)`.
- O estado atual de cada tribunal (`edicoesLidasNestaRodada`, contadores, `matches`) já é local por tribunal e continua assim.
- `progresso.atual` passa a mostrar o tribunal executado mais recentemente. Os cartões já mostram o status de cada item.
- `flushProgresso`: trocar por uma gravação serializada (uma promessa encadeada), para duas gravações em paralelo não sobrescreverem o progresso. Totais (`novas`, `registros_processados`) são somados a partir dos itens na hora de gravar.
- Cancelamento: quando um worker detecta o cancelamento, marca uma flag compartilhada. Os outros workers saem no próximo ponto de verificação. Os itens pendentes ou em execução ficam como cancelados.
- Inserções/deduplicação no banco não mudam (já são idempotentes por hash e coordenação).
- Deploy da função e acompanhamento de uma execução manual de 10/11 para comparar o tempo com o atual.
