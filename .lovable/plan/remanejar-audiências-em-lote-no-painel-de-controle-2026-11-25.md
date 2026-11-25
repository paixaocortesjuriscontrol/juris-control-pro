# Remanejar audiências em lote no Painel de Controle

Hoje a janela "Remanejamento em lote" só oferece Tarefas, Prazos e Eventos. Ela vai ganhar a opção **Audiências**, com o mesmo funcionamento.

## O que a pessoa poderá fazer
- Escolher **Audiências**, filtrar por período, coordenação, responsável e situação, e marcar várias de uma vez.
- **Data da audiência**: manter, escolher uma nova data ou adiar/antecipar X dias (com opção de dia útil). O horário de cada audiência continua o mesmo.
- **Responsáveis**: manter, trocar ou acrescentar pessoas, como já acontece nos outros tipos.
- Ver o resumo e confirmar antes de gravar. Audiências sem permissão aparecem como erro no aviso final.

## Detalhes técnicos
- `usePessoasEmLote.ts`: incluir `datas: { data_audiencia }` nos itens vindos de `audiencias_detectadas`.
- `RemanejamentoTarefasSheet.tsx`: adicionar "Audiências" em `TIPOS_REMANEJAVEIS` e o campo `data_audiencia` (data e hora) em `CAMPOS`. Gravar em `audiencias_detectadas` e confirmar a linha retornada. Responsáveis vão para `audiencias_advogados (audiencia_id, advogado_id)` pelo `sincronizarParticipantesTarefa` já usado no sistema: primeiro inclui, depois remove. Nunca apagar tudo e reinserir.
- Sem mudanças no banco. As regras de permissão e de agendamento continuam valendo pelos gatilhos que já existem.
- Atualizar a versão e testar a regra de data (o horário é mantido ao adiar).
