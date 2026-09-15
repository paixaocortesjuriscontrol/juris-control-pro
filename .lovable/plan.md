# Limpar a fila de mensagens (WhatsApp Z-API)

## Situação verificada agora (15/09/2026, 14:19 BRT)

Fila de avisos de audiência ainda não enviados: **912 lembretes**.

- **192** são de audiências que **já aconteceram** (a mais antiga em 26/02/2026).
- **9** estão **vencidos agora** (horário de disparo já passou).
- **711** são de audiências **futuras** e devem continuar valendo.

Outras filas estão limpas: nenhum aviso de evento, de parcela ou da fila geral de notificações está pendente.

## O que fazer

1. Descartar os **201** avisos atrasados (192 de audiências passadas + 9 vencidos): marcá-los como já enviados, sem disparar nada. Isso evita a enxurrada de mensagens antigas quando o celular voltar a conectar.
2. Preservar intactos os **711** avisos de audiências futuras — eles continuam sendo enviados nos horários corretos.
3. Conferir depois da limpeza que a fila atrasada ficou em zero e que a rotina de minuto a minuto voltou a rodar sem acumular.

Nada é apagado do histórico de audiências nem das mensagens já enviadas; apenas os avisos atrasados deixam de ser disparados.

## Detalhes técnicos

- `lembretes_audiencia`: `update ... set enviado = true, enviado_em = now()` para os registros com `enviado = false` cujo `audiencias_detectadas.data_audiencia < now()` ou cujo horário de disparo (`data_audiencia - minutos_antes`) já passou.
- Sem alteração de código nas edge functions `processar-lembretes-audiencia` / `enviar-whatsapp-zapi`; a proteção de "audiência muito no passado" já existe, mas só é aplicada em lotes de 50 por minuto, o que faria o acúmulo escoar lentamente.
- Verificação final: contagem de pendentes por faixa (passado / vencido / futuro) e leitura dos logs da função.
