# Carga Benner: separador de pedidos e relatório de recusas do Santander

## Diagnóstico (verificado na planilha enviada e no retorno)
- 492 linhas enviadas, 127 recusadas, 62 matérias citadas.
- Não é erro de grafia nem de lista oficial: 60 das 62 matérias recusadas foram aceitas em outras linhas do mesmo arquivo (ex.: "Honorários de Sucumbência" recusada em 50 linhas e aceita em 93). A causa é a informada por eles: o pedido não está cadastrado naquele dossiê no Benner.
- O cabeçalho do layout exige pedidos separados por **ponto e vírgula**; hoje a exportação usa **vírgula**. Além do formato estar fora do padrão, 8 pedidos da lista oficial têm vírgula no nome (ex.: "Complementação de Aposentadoria - Regulamento de Pessoal - 3,5%"), que seriam partidos em dois pedidos inexistentes.

## O que será feito
1. **Separador correto**: nas colunas de matérias (Favorável/Desfavorável turma, Favorável/Desfavorável relator, Bem/Mal aparelhado, Com chances de êxito, Sem chance de êxito) os pedidos passam a ser unidos por `;` em vez de `,`.
2. **Relatório de recusas do Santander**: nova opção no Acesso Rápido da Distribuição TST — "Conferir retorno do Santander". O usuário cola o texto de retorno; o sistema:
   - identifica as linhas recusadas e as matérias citadas em cada uma;
   - cruza com a última carga (por número de linha e, quando disponível, pelo IDENTIFICADOR/dossiê presente no texto);
   - exibe a lista e exporta uma planilha `Pedidos_Nao_Cadastrados_Dossie.xlsx` com Dossiê, Processo, Parte Recorrente, Campo (posição turma/relator, aparelhamento, chance de êxito) e Pedido recusado, para pedir o cadastro ao Santander.
3. Nenhum bloqueio novo de geração e nenhuma mudança de schema.

## Detalhes técnicos
- `src/components/distribuicao-tst/CargaBennerFromDb.tsx`: `joinUniqueMat` passa a usar `out.join(";")` (linha ~636); mesma mudança vale para as células de rejeição que reúsam a função.
- Novo componente `src/components/distribuicao-tst/RetornoSantanderDialog.tsx`: textarea + parser com regex `Linha (\d+) : (.+?) não localizado com a informação (.+?) \.` e captura de `IDENTIFICADOR = <dossiê>`; agrupa por linha, resolve o dossiê pela ordem das linhas da carga (Linha N = linha N+1 da planilha) e usa o IDENTIFICADOR quando presente; exportação via `xlsx`.
- Item adicionado ao dropdown "Acesso Rápido" em `src/pages/DistribuicaoTst.tsx`.
- Para vincular linha → dossiê sem depender do arquivo enviado, o dialog aceita opcionalmente o upload da própria planilha de carga; se não for enviada, mostra só linha + pedido recusado.
