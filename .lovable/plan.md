# "Outra Matéria": vira aviso, não pendência

## O que está acontecendo

Na ficha da Distribuição TST, quando a única matéria escolhida de uma parte é **Outra Matéria**, a tela acusa a pendência "Revisar lista de matérias / Sem matérias cadastradas para o dossiê — NÃO irá para a planilha de Carga Benner".

Isso está errado, e a prova está na própria geração da Carga Benner: lá, **Outra Matéria é sempre aceita** (vai para a planilha com o nome em branco), sem depender da lista de pedidos do dossiê. Ou seja, a tela acusa uma rejeição que a planilha não faz.

O efeito ficou mais visível depois da limpeza de hoje (16/09/2026), porque 7.054 dossiês perderam a "lista de pedidos" falsa que havia sido carregada por engano — dossiês sem lista voltaram a cair nessa regra.

## Como vai ficar

1. **Outra Matéria nunca gera pendência.** A ficha deixa de ficar vermelha e volta a contar como pronta sem pendência.
2. No lugar da pendência, aparece um **aviso amarelo** ("Verificar"): "Somente 'Outra Matéria' selecionada — conferir lista de matérias do dossiê". O aviso não bloqueia nada e a linha continua indo para a planilha de Carga Benner.
3. Na coluna Pendências da lista, essas fichas passam a mostrar o aviso em amarelo em vez do selo vermelho.
4. Novo **card de aviso** na faixa de totalizadores: "Somente Outra Matéria (aviso)", em amarelo, clicável como os demais cards, mostrando quantas fichas prontas estão nessa situação.
5. As fichas já marcadas por engano são corrigidas automaticamente, sem ninguém precisar clicar em "Verificar Pendências".

## Detalhes técnicos

- `src/utils/distribuicaoTstPendencias.ts`
  - `getMateriasForaDoDossie`: tratar `isOutraMateria(nome)` como válida independentemente de `res.temLista`; registrar por bloco se a parte tem Outra Matéria.
  - `precisaRevisarListaMaterias`: partes cuja seleção inclui Outra Matéria não entram em `partesSemMateriaValida`, inclusive quando o dossiê não tem lista.
  - Novo item com `aviso: true` e `key: "somente_outra_materia"` em `getPendenciasRejeicaoCarga` quando a parte ativa só tem Outra Matéria.
  - `semNenhumaMateriaDoDossie`: aceitar Outra Matéria como válida (alinhado com a exportação).
- Banco: nova coluna booleana `dados_benner.somente_outra_materia` (default `false`, índice parcial) gravada junto de `sem_pendencia`/`revisar_lista_materias` em `src/utils/distribuicaoTstSemPendencia.ts` (`recalcularSemPendencia`, `atualizarSemPendenciaRegistro`, `atualizarSemPendenciaLote`).
- `src/hooks/useDistribuicoesTst.ts`: filtro `somenteOutraMateria` (`"sim"`), aplicado nas três consultas, como já é feito com `revisarListaMaterias`.
- `src/components/distribuicao-tst/DistribuicaoTstStatsCards.tsx`: nova chave `somenteOutraMateria` em `StatsCardKey` e card amarelo opcional, no mesmo padrão de `revisarListaMaterias`.
- `src/pages/DistribuicaoTst.tsx`: contagem do novo card (hook de contagem por filtro), clique aplicando o filtro, e coluna Pendências exibindo avisos em amarelo quando não houver pendência.
- Correção dos dados existentes: marcar `pendencias_verificado_em` com data antiga nas fichas prontas para a revalidação automática regravar os marcadores.
- Nada muda em `CargaBennerFromDb.tsx` — a geração da planilha já está correta.
