## Reclamação procede

Na Visão Geral do processo, o quadro "Pendências do processo" só mostra itens com situação exatamente "Pendente". O prazo de Recurso Ordinário (fatal em 29/10/2026) está em "Minutado - Revisão", então some do quadro mesmo sem ter sido baixado. A aba Prazo, por outro lado, mostra esse prazo como pendente. Por isso as duas telas mostram coisas diferentes.

## Correção

O quadro vai seguir a mesma regra usada nos cards do Painel. Um item continua aparecendo enquanto estiver em aberto, ou seja, em qualquer situação diferente de cumprido, concluído, concluído sem sucesso, tratado, cancelado, cancelado oculto, protocolado, baixado ou verificado. Isso vale também para itens sem data de conclusão.

- Isso vale para tarefas, prazos, eventos e audiências.
- Cada item mostra a sua situação (por exemplo, "Minutado - Revisão"), como já acontece na aba Prazo.

## Detalhe técnico

- `src/components/processos/PendenciasProcessoCard.tsx`: trocar `status === 'pendente'` em `tarefaEmAberto`, `eventoEmAberto` e no filtro de audiências por um teste de "não encerrado", usando uma lista única de situações encerradas.
- Adicionar teste com estes casos: `minutado_revisao` aparece no quadro; `cumprido` e `baixado` não aparecem.
