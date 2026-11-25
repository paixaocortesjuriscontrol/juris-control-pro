# Tarefas que "sumiram" — o que encontrei

Conferido em 25/11/2026 (BRT). Procede: hoje três grupos de tarefas saíram da agenda.

1. **3.301 tarefas apagadas a seu pedido**: da migração Projuris na Santander Cível, com data depois de 13/11/2026 (de 16/11/2026 a 26/07/2027). 2.463 ainda estavam abertas. A cópia de segurança completa está guardada.
2. **5.134 tarefas canceladas pela migração de hoje**: 4.692 marcadas como "excluída no Projuris" e 442 como "inativada no Projuris". Elas existem, mas aparecem como Canceladas.
3. **16 tarefas apagadas por pessoas** no próprio sistema, fora da migração.

## Proposta
- Gerar um Excel com os três grupos (coordenação, responsáveis, título, data, processo e motivo), para as advogadas acharem as tarefas delas.
- Não restaurar nada sem a sua decisão. Se quiser, devolvo depois pela cópia de segurança um grupo inteiro, ou só as tarefas de pessoas que você indicar.

## Detalhes técnicos
- Fontes: `bkp_tarefas_pos_corte_20261125` e `auditoria_tarefas` (ações `deletar`, `excluida_no_projuris`, `inativada_no_projuris`) desde 24/11 21h BRT.
- Só leitura, sem alterar o banco.
