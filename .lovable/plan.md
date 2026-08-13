# Deixar claro o comparativo de execuções do DJEN Termos

## O problema

Hoje cada célula mostra o número de publicações que **aquela execução viu** e, a partir da segunda coluna, um `+N` verde ao lado. Isso gera duas leituras confusas:

- A segunda execução costuma ver **menos** publicações que a primeira (cobre outra fatia do dia / outros tribunais), então "80" e depois "21 +7" parece um retrocesso, quando significa: a execução das 10:00 viu 21 publicações, das quais 7 eram inéditas.
- A coluna **Total** soma os números de todas as execuções. Como a mesma publicação pode ser vista em mais de uma execução, esse total infla e não corresponde ao número real de publicações do dia da coordenação.

## O que vai mudar (apresentação da tabela)

1. **Número principal da célula passa a ser "novas"** (publicações inéditas naquela execução), em destaque. O total visto na execução vira informação secundária, em texto menor e cinza, no formato `de 21 vistas`. Leitura final: "as 10:00 trouxe 7 novas (viu 21)".
2. **Primeira execução deixa de ser exceção**: hoje o `+N` é escondido na primeira coluna com valor. No novo formato toda coluna mostra "novas" — na primeira execução, novas = tudo o que ela trouxe.
3. **Coluna Total passa a ser o total de publicações únicas do dia** da coordenação (soma das novas), sem duplicar quem apareceu em mais de uma execução. Ao lado, em cinza, o número de leituras somadas (`101 vistas`) para quem quiser conferir.
4. **Rodapé Totais** segue a mesma regra: por coluna, novas em destaque e vistas em cinza; no fim, total de publicações únicas do dia.
5. **Cabeçalho e legenda** ajustados: cada coluna ganha o rótulo "novas / vistas" e a legenda explica em uma linha que "novas" = publicações vistas pela 1ª vez naquele horário, dentro da coordenação, e que "vistas" pode repetir entre execuções.

Nenhuma regra de cálculo no banco muda — só como os números já existentes são exibidos e rotulados.

## Detalhes técnicos

- `src/components/djen/ExecucoesDoDiaAdminCard.tsx`: reescrever a renderização das células (corpo e `TableFooter`), remover a lógica `isFirstNonZero` e o prefixo `+`, trocar a coluna Total por `l.novasGeral` com `l.totalGeral` como valor secundário, atualizar cabeçalho e legenda.
- `src/hooks/useExecucoesDoDiaPorCoordenacao.ts`: sem mudança de consulta; os campos `novas`, `total`, `novasGeral` e `totalGeral` já existem e passam a ser usados nessa nova hierarquia visual.