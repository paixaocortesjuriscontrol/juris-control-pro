# Docs TST: arquivo de Pauta que "não aparece" para download

## O que o advogado relatou procede — em parte

O sistema realmente classificou as pautas (a mensagem "8 pautas" vem da contagem real), mas os arquivos são baixados em sequência, um `.docx` por categoria, e o navegador entrega só o primeiro. Confirmado no código: em `handleGerarDocsTST` cada arquivo é baixado com um link temporário que **não é inserido na página** e cuja URL é **liberada imediatamente após o clique** (`URL.revokeObjectURL` na mesma linha). Nessa condição o Chrome cancela silenciosamente os downloads seguintes (também dispara o bloqueio de "vários downloads automáticos"). Por isso chegou apenas o arquivo de Temas e o de Pauta se perdeu — não houve perda de publicação, só de arquivo.

Sobre o dia 28/08: no banco existem, sim, publicações do TST com pauta de julgamento nessa data (várias dezenas na base geral do dia). Portanto a mensagem "não havia pautas" naquele dia não vem de ausência de dados na base; provavelmente vem dos filtros ativos na tela (coordenação/monitoramento/período/status de leitura) no momento da geração. Isso precisa ser confirmado reproduzindo com os mesmos filtros dele — está incluído como primeiro passo.

## O que será feito

1. **Entregar todos os arquivos, sempre**
   - Quando houver mais de uma categoria, gerar **um único .zip** (`JURISCONTROL_DOCS_TST_<data>.zip`) com os `.docx` dentro. Um download só, nada de bloqueio do navegador.
   - Quando houver uma única categoria, baixar o `.docx` direto (como hoje).
   - Corrigir o mecanismo de download: inserir o link na página, clicar, remover e só então liberar a URL.

2. **Painel de resultado após a classificação**
   - Depois de gerar, mostrar a lista de categorias com a quantidade encontrada e um botão **Baixar** por categoria, para o usuário rebaixar qualquer arquivo (ex.: só a Pauta) sem reprocessar tudo.

3. **Diagnóstico do dia 28/08**
   - Reproduzir a geração com o recorte de filtros da coordenação para verificar se as pautas do dia estavam sendo excluídas por filtro (e não pela regra de classificação). Se o corte vier do filtro, ajustar o texto da mensagem para deixar explícito o período/filtros considerados, evitando a leitura de "não existe pauta".

## Detalhes técnicos

- Arquivo: `src/pages/AnaliseDjen.tsx`, função `handleGerarDocsTST`.
- Substituir o helper `dl` por um download seguro (append/remove do anchor, `revokeObjectURL` com atraso) e por um empacotamento em `JSZip` quando `dg > 1` (JSZip já é usado no projeto).
- Guardar os blobs gerados em estado (`{ categoria, filename, blob, total }[]`) para alimentar o painel de rebaixar.
- A regra de classificação (TEMAS_IRR / PAUTA / CEJUSC / DISTRIBUIÇÕES / INTIMAÇÕES / PRAZOS) permanece inalterada.
- Nenhuma alteração de banco, Edge Function ou nos demais botões de resumo.
