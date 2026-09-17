# Atividade dentro de um prazo aparece como concluída

## O que a Katarine relatou procede

A atividade "CONFIRMAR PAGAMENTO DA GUIA JUNCERJA" (prevista para 23/09/2026) está no banco como **pendente**, sem data de conclusão. O prazo em que ela foi criada está concluído.

O problema é só de exibição: na agenda, a atividade é riscada quando o **prazo/tarefa em que ela foi criada** está concluído — mesmo que a atividade continue pendente. Nada foi concluído por engano no sistema; a marcação riscada é enganosa.

Isso contraria a regra já adotada no sistema: concluir o item (prazo, tarefa, audiência, evento) não conclui as atividades — cada uma é marcada manualmente.

## Correção

A atividade só aparece riscada quando **ela mesma** estiver encerrada (concluída, cancelada ou não realizada). A situação do prazo/tarefa deixa de influenciar a aparência da atividade, tanto nos quadradinhos do calendário quanto na lista lateral do dia.

Sem mudança de dados: a atividade da Katarine já está pendente e voltará a aparecer normalmente (letras azuis, sem risco) assim que a correção subir.

## Detalhes técnicos

- `src/pages/PainelControle.tsx` (~linha 2976): remover o `isItemTratado(pai)` da condição de `line-through opacity-70` das atividades do dia, deixando apenas `atividadeEncerrada(a.situacao)`.
- `src/components/painel/DiaAgendaLateral.tsx` (~linhas 320-346): remover `paiTratado` do cálculo de `encerrada` usado no risco/cor da atividade.
