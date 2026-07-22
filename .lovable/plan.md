## Diagnóstico

A tarefa **"tarefa teste para o Eduardo verificar..."** existe (id `6b8e6e16...`), com:
- `data_vencimento = 2026-07-21`
- `data_fatal = NULL`
- `status = pendente`
- responsável = Eduardo Torres

A Edge Function `alertar-prazos-perdidos` **filtra apenas por `data_fatal < hoje`**:

```ts
.lt("data_fatal", hoje)
```

Como a tarefa foi criada só com **data prevista** (`data_vencimento`) e sem `data_fatal`, ela **nunca entra no filtro** — por isso o Eduardo não recebeu o alerta de atraso.

Além disso, a função hoje só olha `tarefas`. Não trata **eventos, audiências e parcelas** vencidos sem tratamento, apesar da Central de Notificações prometer "alerta de itens vencidos" para todos os tipos do botão Adicionar.

## Correções propostas em `supabase/functions/alertar-prazos-perdidos/index.ts`

1. **Considerar atraso quando qualquer uma das datas passou:**
   - Tarefa vencida = `COALESCE(data_fatal, data_vencimento) < hoje` e status não concluído/cancelado/arquivado/tratado.
   - Assim, tarefas só com data prevista (caso do teste) entram no alerta.

2. **Expandir para os demais tipos do botão Adicionar** (mesma regra unificada de destinatários já usada nas outras 3 funções: config + responsáveis + envolvidos + criador):
   - **Eventos** (`eventos_agenda`): `data_inicio < hoje` e status ≠ concluido/cancelado/tratado.
   - **Audiências** (`audiencias_detectadas`): `data_audiencia < hoje` e status não em (tratado, ignorado, cancelado, realizada).
   - **Parcelas** (`parcelas_evento`): `data_vencimento < hoje` e sem `pago_em`/status pago (a confirmar com uma leitura da tabela).

3. **Dedup diário por usuário+tipo** no `historico_alertas_enviados` (hoje já existe por usuário; passar a incluir o tipo para não colidir entre categorias).

4. **Respeito à configuração do usuário** (`config_notificacoes_usuario.evento_prazo_perdido` e canais) — mantido como está.

## Verificação após o deploy

- Rodar a função manualmente via `supabase--curl_edge_functions` (`POST /alertar-prazos-perdidos`).
- Confirmar em `historico_alertas_enviados` um registro com `tipo_alerta='prazo_perdido'`, `destinatario = e98847c9-...` (Eduardo) e status `enviado`.
- Confirmar que a tarefa `6b8e6e16...` aparece no corpo da mensagem.

## Fora de escopo

- Não altero UI da Central de Notificações.
- Não altero as outras 3 funções de alerta (já aplicam a regra unificada).
- Não mudo o agendamento do cron.
