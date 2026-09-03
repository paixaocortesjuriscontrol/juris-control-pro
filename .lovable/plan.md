# Análise DJEN: totalizadores não atualizam após descartar duplicadas

## Problema relatado
A Jéssica clica em "Descartar duplicadas da coordenação", o sistema descarta (o aviso mostra, por exemplo, "31 duplicada(s) descartada(s)"), mas os números do topo (Total no período, Não lidas, Termos, Processos, Únicas) continuam com o valor antigo até recarregar a página.

## Causa confirmada
Em `src/pages/AnaliseDjen.tsx`, a função de descarte em lote atualiza apenas parte dos caches:

- `publicacoes-unificadas` (a lista)
- `descartadas-dedup`, `descartadas-count`, `descartadas-lotes-recentes`

Os cards do topo vêm de outra consulta, `publicacoes-unificadas-stats-header` (em `src/hooks/usePublicacoesDjenUnificadas.ts`), que **não** é invalidada nesse fluxo — por isso ela segue servindo o valor em cache. O mesmo vale para a contagem do Kurier (`analise-djen-kurier-count`) e o badge de notificações (`notificacoes-counts`). O botão "Desfazer" do lote tem exatamente a mesma falha, então ao desfazer os números também não voltam.

Para comparação: o descarte de selecionadas individuais já invalida `publicacoes-unificadas-stats-header` corretamente — é só esse caminho em lote que ficou incompleto.

## Correção
1. Na função `descartarDuplicadasCoordenacao`, acrescentar a invalidação de:
   - `publicacoes-unificadas-stats-header`
   - `analise-djen-kurier-count`
   - `notificacoes-counts`
2. Fazer o mesmo em `desfazerDescarteLote` (botão Desfazer do toast e "Desfazer último"), para que os números voltem ao estado anterior.
3. Aplicar a mesma correção no "Desfazer descarte" individual da aba Descartadas, que hoje também deixa os cards do topo desatualizados.
4. Aguardar (`await`) as invalidações antes de exibir a mensagem de sucesso, seguindo o padrão do projeto, para o usuário só ver o aviso quando os contadores já estiverem em atualização.

## Observação
Não muda nenhuma regra de descarte nem a RPC no banco — apenas a atualização da tela. A mesma verificação será feita na tela equivalente `AnaliseDjenServidor.tsx`, que repete o padrão de invalidação.
