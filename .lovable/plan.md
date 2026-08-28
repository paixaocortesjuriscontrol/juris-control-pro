# Resumo Intimação sem repetição: remover pautas

## Objetivo
Na tela Análise DJEN, o arquivo "Doc Resumo Intimação sem repetição" deve trazer apenas intimações — sem pautas de julgamento. Os demais arquivos (Doc Resumo Intimação normal, Excel Intimações, Excel Intimações sem repetição, resumos gerais) continuam exatamente como estão.

## Comportamento
- Ao gerar o "Doc Resumo Intimação sem repetição", além de já excluir as Listas de Distribuição, o sistema também descarta as publicações identificadas como pauta de julgamento.
- O critério de pauta é a detecção automática pelo texto da publicação, a mesma regra já usada hoje no sistema para marcar "PAUTA DE JULGAMENTO (ÍNTEGRA)".
- O título dentro do documento passa a indicar: "Resumo de Intimações DJEN (sem Lista de Distribuição, sem pautas, sem repetição)".
- A mensagem de conclusão continua informando quantas publicações foram ignoradas (listas + pautas + duplicadas).
- Se após a remoção não sobrar nenhuma publicação, aparece um aviso claro de que só havia listas/pautas e nada é baixado.

## Detalhes técnicos
- Arquivo: `src/pages/AnaliseDjen.tsx`, função `handleGerarDocResumoIntimacao(semRepeticao)`.
- Aplicar o filtro extra apenas quando `semRepeticao === true`: após o filtro `ehListaDistribuicao`, remover itens em que `isPautaDeJulgamento(pub.conteudo)` seja verdadeiro, antes de chamar `dedupPubsPorProcessoSemDestinatarios`.
- Ajustar o texto do cabeçalho gerado por `buildDocHeader` e a mensagem de erro de lista vazia para o caso `semRepeticao`.
- Nenhuma alteração em banco de dados, nas exportações Excel ou nos demais botões de resumo.
