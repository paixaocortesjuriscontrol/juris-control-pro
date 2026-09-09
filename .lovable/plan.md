# Eventos repetidos não aparecem na pasta do processo

## O que está acontecendo

A Dra. Janaína criou, hoje às 11:30, um evento "Conferir semanalmente" na pasta do processo 0000765-04.2013.5.10.0004, com repetição em dias úteis até 18/12/2026. O evento foi gravado corretamente com a regra de repetição — o problema é só de exibição.

Na aba **Agenda** dentro da pasta do processo, a lista de eventos mostra exatamente os registros gravados, um por evento. Repetições ficam guardadas em um único registro e precisam ser "abertas" em várias datas na hora de mostrar — é o que já acontece na Agenda geral e no painel lateral de Processos e Casos, mas não acontece na pasta. Por isso a advogada vê só uma data e conclui que não repetiu.

O mesmo vale para o card de pendências e para os contadores da visão geral da pasta, que hoje contam um evento onde deveriam contar as repetições.

## O que será feito

1. Na pasta do processo, abrir as repetições dos eventos usando a mesma regra já usada na Agenda geral (diário, dias úteis, semanal, mensal, anual, com data-limite).
2. Agrupar as repetições em uma única linha, como no painel lateral: mostra a próxima ocorrência com um selo indicando quantas repetições existem, e um clique expande a série.
3. Clicar em qualquer ocorrência continua abrindo o evento original para edição (a repetição não é um registro separado).
4. Manter os contadores/pendências da pasta coerentes com o que passa a ser exibido.

## Detalhes técnicos

- `src/components/processos/ProcessoDetalhesCompletos.tsx`: derivar de `eventosDoProcesso` uma lista expandida com `expandirOcorrencias` + `janelaRecorrenciaPadrao` (`src/utils/recorrencia.ts`), gerando ids sintéticos `${id}::${data}` e `recorrencia_pai_id`, e agrupar as ocorrências por série (mesmo padrão de `agruparRecorrencias` em `ProcessoItensLateral.tsx`). No clique, usar `recorrencia_pai_id ?? id.split("::")[0]` ao chamar `abrirNovoItem("evento", ...)` com o registro original.
- Não alterar a query `eventos-agenda-processo` em `src/pages/ProcessoDetalhes.tsx` (ela alimenta edição e outros consumidores); a expansão fica na camada de exibição.
- Excluir da expansão eventos com `grupo_parcelas` (parcelamentos já têm registros próprios), como nos demais pontos do sistema.
