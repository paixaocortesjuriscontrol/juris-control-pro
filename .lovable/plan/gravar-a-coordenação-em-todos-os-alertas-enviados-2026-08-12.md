# Gravar a coordenação em todos os alertas enviados

## Diagnóstico (confirmado)

Nos últimos 10 dias, quase todos os registros de `historico_alertas_enviados` estão sem coordenação: em 12/08 foram 547 sem coordenação e apenas 11 com. Os tipos sem coordenação são `mudanca_situacao` (467), `comentario` (65), `prazo_perdido` (14) e `resumo_diario_agenda` (1).

Motivo: três rotinas de envio simplesmente não preenchem esse campo ao gravar o histórico:

- `notificar-mudanca-situacao` (mudança de situação, comentário, menção) — grava sem coordenação, embora a fila de notificações (`notificacoes_fila`) já traga a coordenação preenchida em 100% dos casos (317 de 317 nos últimos 3 dias).
- `alertar-prazos-perdidos` — grava sem coordenação.
- `enviar-agenda-do-dia` (resumo diário) — grava sem coordenação.

As rotinas por coordenação (`enviar-alertas-tarefas`, `enviar-alerta-coordenacao`) já gravam corretamente — são os 11 registros com coordenação.

Observação adicional confirmada no código: em `alertar-prazos-perdidos` e `enviar-agenda-do-dia` o campo destinatário guarda o **ID do usuário**, e não o e-mail/telefone. Como a tela casa mensagens pelo e-mail/telefone do usuário, essas mensagens não aparecem no modo Pessoal.

## O que será feito

1. Mudança de situação / comentário / menção: passar a gravar a coordenação vinda da fila de notificações em cada registro do histórico.
2. Prazos perdidos: gravar a coordenação do item que gerou o alerta (ou a coordenação do usuário destinatário, quando o item não tiver).
3. Resumo diário da agenda: gravar a coordenação do usuário destinatário.
4. Padronizar o destinatário: gravar o e-mail (canal e-mail) e o telefone (canal WhatsApp) nessas duas rotinas, para que as mensagens também apareçam no modo Pessoal.
5. Correção retroativa dos registros já gravados sem coordenação, quando for possível deduzi-la:
   - por referência do item (tarefa/evento/audiência vinculado ao alerta);
   - quando não houver item, pela coordenação do usuário destinatário.
6. Ajuste na tela: manter visíveis os registros antigos que continuarem sem coordenação (não é possível deduzir todos), sem deixar de aplicar o filtro para os que têm coordenação.

## Detalhes técnicos

- Edge Functions alteradas: `notificar-mudanca-situacao` (usa `item.coordenacao_id` da `notificacoes_fila`), `alertar-prazos-perdidos` (coordenação do item / `get_user_coordenacao`), `enviar-agenda-do-dia` (coordenação do usuário).
- Backfill via UPDATE em `historico_alertas_enviados` fazendo join de `referencia_id` com `eventos_agenda`/`tarefas` para obter `coordenacao_id`; fallback por `membros_coordenacao` do destinatário.
- Frontend: em `MinhasMensagensRecebidas.tsx` o filtro de coordenação continua incluindo `coordenacao_id is null` apenas para registros anteriores à correção (mensagens novas passarão a ter coordenação e serão filtradas corretamente).
