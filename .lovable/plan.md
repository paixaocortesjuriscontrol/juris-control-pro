# Comparativo de execuções do DJEN Termos: diagnóstico e correção

## O que a investigação mostrou (13/08/2026)

Conferi as duas execuções Servidor · Termos do dia e o caso da Dra. Renata:

- Execução 04:30: 1.564 publicações; execução 10:00: 1.282, com 307 inéditas.
- Dra. Renata: 80 na 1ª, 21 na 2ª, sendo 87 publicações distintas no dia — ou seja, a 2ª execução só reviu **14** das 80.
- **Todas as 80 publicações dessa coordenação são do TST**, e a execução das 10:00 registrou **27 falhas de captura no TST** (o card já mostra 422 falhas no total, contra bem menos na 1ª execução). Logo, a queda é real: a 2ª execução cobriu menos porque partes do TST falharam/foram abandonadas.
- Além disso, o número exibido por execução não é "tudo que a execução viu": em dois caminhos do motor a republicação é contada como duplicata e o vínculo publicação×execução **não é gravado** (dedupe em memória dentro da própria rodada e o caminho de conflito de índice). Isso deprime ainda mais a segunda coluna.
- A coluna **Total** soma as colunas; como a mesma publicação aparece em mais de uma execução, esse total infla (Renata mostra 101 em vez de 87 reais).

## Correção 1 — registrar toda republicação

No motor Servidor (Termos), gravar o vínculo publicação×execução também nos dois caminhos que hoje só incrementam o contador de duplicatas: o dedupe da própria rodada e o tratamento de conflito de índice. Assim o número por execução passa a representar de fato "o que aquela execução viu", e cair de uma execução para outra passa a significar cobertura menor, não falta de registro.

## Correção 2 — deixar a leitura da tabela óbvia

1. **Número principal da célula passa a ser "novas"** (publicações inéditas naquela execução), em destaque; o total visto vira informação secundária em cinza, no formato `de 21 vistas`. Leitura: "as 10:00 trouxe 7 novas (viu 21)".
2. **Primeira execução deixa de ser exceção**: hoje o `+N` é escondido na primeira coluna com valor; no novo formato toda coluna mostra novas.
3. **Coluna Total passa a ser o total de publicações únicas do dia** da coordenação (soma das novas), com as leituras somadas em cinza ao lado.
4. **Rodapé Totais** segue a mesma regra.
5. **Cabeçalho e legenda** ganham o rótulo "novas / vistas" e uma linha explicando que "vistas" pode repetir entre execuções.

## Correção 3 — explicar a queda na própria linha do cabeçalho

Cada coluna de execução passa a mostrar, abaixo do horário, um selo com as falhas de captura daquela execução (ex.: `422 falhas`) quando houver. Uma execução com muitas falhas fica visivelmente marcada, então um número menor deixa de parecer erro de contagem.

## Detalhes técnicos

- `monitor-servidor/engines/paralela.js` (`persistPublicacoes`): no `continue` do `seenRunKeys` e no branch de conflito/`upsert_ignorado`, resolver o id da publicação existente e fazer o mesmo `upsert` em `publicacoes_djen_servidor_execucoes` já usado no caminho de duplicata confirmada.
- `src/components/djen/ExecucoesDoDiaAdminCard.tsx`: reescrever células (corpo e `TableFooter`), remover `isFirstNonZero` e o prefixo `+`, trocar a coluna Total por `novasGeral` com `totalGeral` em cinza, adicionar selo de falhas por execução no cabeçalho, atualizar legenda.
- `src/hooks/useExecucoesDoDiaPorCoordenacao.ts`: expor por execução a contagem de falhas (agregada de `execucoes_servidor_falhas` / `resultado.falhas_por_tribunal`) para alimentar o selo; os campos `novas`, `total`, `novasGeral` e `totalGeral` já existem.