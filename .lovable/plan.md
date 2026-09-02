# Matérias do dossiê como filtro da Carga Benner

Somente as matérias "verdes" (que constam na lista de pedidos do dossiê) podem ir para a planilha de Carga Benner. Processos prontos sem nenhuma matéria verde ficam marcados na lista como **Revisar lista de matérias** e não são exportados.

## O que será feito

### 1. Marcação na lista (Distribuição TST)
- Na coluna de pendências, processos marcados como pronto (pronto_envio / planilhado / enviado) cujo dossiê tem pedidos cadastrados e **nenhuma** das matérias selecionadas consta nessa lista passam a exibir uma etiqueta vermelha **"Revisar lista de matérias"**.
- A etiqueta aparece junto das demais pendências (ou sozinha, no lugar de "Sem pendências").
- Processos cujo dossiê não tem pedidos cadastrados continuam como hoje (sem a marcação), já que não há lista para comparar.
- Esses processos passam a contar como **pendentes**: deixam de aparecer como "Sem pendências"/concluídos nos totalizadores e filtros, para a lista não ficar desorganizada.

### 1b. Card "Revisar Lista de matérias"
- O card **Sem Responsável** sai dos totalizadores.
- Entra no lugar o card **Revisar Lista de matérias**, com a contagem dos processos prontos sem nenhuma matéria da lista do dossiê.
- Ao clicar, filtra a lista exatamente como os demais cards (e clicar de novo limpa o filtro).


### 2. Geração da Carga Benner
- Ao montar cada linha, as matérias passam por um novo filtro: além da lista oficial do Santander, precisam constar na lista de pedidos **daquele dossiê**.
  - Exemplo: 7 matérias selecionadas e 2 na lista do dossiê → só as 2 vão para as colunas de matérias.
- Processo sem nenhuma matéria aproveitável vai para a aba de **Rejeições**, com o motivo "Nenhuma matéria consta na lista de pedidos do dossiê — revisar lista de matérias".
- "Outra Matéria" continua tratada como hoje (válida, exportada com o nome em branco).
- Quando o dossiê não possui pedidos cadastrados, o comportamento atual é mantido (valida só contra a lista oficial), para não bloquear dossiês ainda não importados.

### 3. Resumo pós-geração
O resumo da geração passa a informar quantos processos foram rejeitados por não terem nenhuma matéria na lista do dossiê e quantas matérias foram descartadas por estarem fora dessa lista.

## Detalhes técnicos
- Extrair a paginação de `pedidos_por_dossie` hoje interna a `src/hooks/useSemMateriaDossiePorResponsavel.ts` para um utilitário compartilhado (`carregarMapaPedidosPorDossie(): Promise<Map<string, Set<string>>>`, chave = dossiê, valor = Set de `pedido_normalizado`), reutilizado pelo hook existente, pela lista e pela carga.
- Novo hook `usePedidosPorDossieMapa()` (React Query, `staleTime` 10 min) consumido em `src/pages/DistribuicaoTst.tsx` para calcular a etiqueta por linha, usando `isMarcadoPronto(d)` de `src/utils/distribuicaoTstPendencias.ts` e `normalizeMateriaNome` de `src/utils/outraMateria.ts` sobre `materias_recurso_reclamante | _banco | _terceiro`.
- Em `src/components/distribuicao-tst/CargaBennerFromDb.tsx`: carregar o mapa uma vez antes do loop; dentro de `filtrarMateriasExportaveis` adicionar a checagem `pedidosDoDossie.has(normalizeMateriaNome(it.materia))` quando o dossiê tiver lista; se após o filtro não sobrar nenhuma matéria e o processo não for de "Outra Matéria", enviar a linha para `rejected` com o novo motivo, em vez de para a planilha.
- Sem mudanças de banco de dados.
