# Repetições agrupadas em todas as opções de Prazos & Eventos

Hoje, dentro da pasta do processo, só a opção **Evento** mostra o item repetido uma única vez (o mais próximo), com o aviso de quantas repetições existem e o botão para expandir. Nas opções **Tarefa**, **Prazo** e **Parc. Recor.** as repetições ainda aparecem soltas ou não aparecem agrupadas.

## O que muda

Todas as opções do menu "Prazos & Eventos" passam a ter o mesmo comportamento:

- **Tarefa** e **Prazo**: cada tarefa/prazo com repetição vira uma linha só, mostrando a ocorrência mais próxima de hoje, com "+ N repetições" para abrir e ver todas.
- **Parc. Recor.**: as parcelas do mesmo parcelamento ficam agrupadas em uma linha, mostrando a próxima parcela e "+ N parcelas" para expandir.
- **Evento**: mantém o comportamento atual, apenas passa a usar a mesma regra compartilhada.
- **Audiência**: fica como está — audiências não têm repetição cadastrada.
- Os contadores ao lado de cada opção do menu passam a somar todas as ocorrências (não só o registro gravado), para o número bater com o que a lista mostra.
- Clicar em qualquer ocorrência (a mais próxima ou uma repetição) continua abrindo o registro original para edição.

## Detalhes técnicos

- Criar em `src/utils/recorrencia.ts` (ou arquivo auxiliar próximo) uma função reutilizável `agruparSerieRecorrente(registros, opts)` que: expande ocorrências com `expandirOcorrencias` + `janelaRecorrenciaPadrao`, escolhe como principal a primeira ocorrência com data >= hoje (fallback: primeira), devolve `{ chave, original, principal, repeticoes[] }` ordenado por data.
- Refatorar `seriesEventos` em `src/components/processos/ProcessoDetalhesCompletos.tsx` para usar o helper.
- Aplicar o helper a `tarefasSemPrazo` e `prazosDoProcesso`, usando como data base `data_vencimento || data_fatal || data_prevista || created_at` e os campos `recorrencia_tipo/intervalo/fim` (as datas de cada ocorrência devem refletir a data expandida, como já é feito em `ProcessoItensLateral.tsx`).
- Para parcelamentos, agrupar por `grupo_parcelas` (registros já existem individualmente; nada a expandir), próxima parcela como principal.
- Reaproveitar o estado de expansão existente generalizando `seriesEventosAbertas` para um `Set` por chave usado nas quatro listas.
- Ajustar os `count` de `navGroups` para `linhas.reduce((a, l) => a + 1 + l.repeticoes.length, 0)`.
