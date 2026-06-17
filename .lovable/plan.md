## Objetivo

1. Mudar o padrão da execução do Kurier para o endpoint de **fila** (`ConsultarPublicacoes`), que traz as publicações **disponibilizadas no dia** e **confirma** cada item lido (removendo-o da fila do Kurier).
2. Drenar todo o backlog acumulado hoje: rodar uma vez em modo fila contra todas as credenciais ativas para esvaziar e confirmar tudo que está parado lá.

## Mudanças de código

### 1. `src/hooks/useDjenTermosKurierEngine.ts`
- Trocar o default de `modoPersonalizado` em `executarDjenTermosKurier` de `true` para `false`.
- Quando o modo for fila (padrão), **não** aplicar o "fallback hoje" em `effInicio`/`effFim` — o endpoint de fila ignora data e a janela é controlada pelo próprio Kurier. Só preencher `effInicio`/`effFim` quando o usuário passar datas explícitas (uso histórico).
- Ajustar mensagens de progresso para refletir "modo fila — disponibilizadas + confirmação automática".

### 2. `src/hooks/useDjenTermosKurier.ts`
- `executar` e `retomar`: trocar default `modoPersonalizado = true` → `false`.
- Assinatura preservada: para reconsulta histórica explícita, basta passar `true`.

### 3. `supabase/functions/kurier-consultar-publicacoes/index.ts`
- Nenhuma mudança de lógica de fila/confirmação (já está correta — confirma cada lote via `ConfirmarPublicacoes`).
- Ajuste cosmético no log inicial: deixar explícito `modo=fila` vs `modo=personalizado` e se vai confirmar ou não.

### 4. Cron `useDjenTermosKurierScheduler` (se houver chamada com `modoPersonalizado`)
- Conferir e alinhar ao novo default fila. Sem alterar frequência.

## Drenar o backlog acumulado (hoje, agora)

Depois de aplicar as mudanças, vou disparar **uma execução em modo fila para cada credencial Kurier ativa**, chamando o edge function `kurier-consultar-publicacoes` direto via `supabase--curl_edge_functions`, com `max_lotes` alto e em loop até a fila retornar 0 recebidas. Cada lote já confirma os itens automaticamente.

Passos:
1. `supabase--read_query` para listar credenciais Kurier ativas (`kurier_credenciais` onde `ativo = true` e `senha_encrypted` não nulo).
2. Para cada credencial, chamar o edge function em loop (`modo_personalizado = false`, `max_lotes = 10`) até a resposta vir com `total_recebidas = 0` ou `lotes_processados = 0`. Limite de segurança: 50 chamadas por credencial.
3. Reportar totais: recebidas, novas, duplicadas, confirmadas por credencial.

Observações:
- Não toca em deduplicação (conforme combinado). Itens já gravados no DB ficam como `duplicadas` no relatório do drenar; o que importa é que **todas saem da fila do Kurier**.
- O botão "Drenar backlog" da UI continua funcionando — agora é redundante com o padrão, mas mantenho para uso futuro.

## Resultado esperado

| Cenário | Endpoint | Confirma? | Cobre o dia? |
|---|---|---|---|
| "Executar Kurier" (novo padrão) | `ConsultarPublicacoes` (fila) | Sim | Sim — disponibilizadas no dia |
| Reconsulta histórica explícita (data preenchida) | `ConsultarPublicacoesPersonalizado` | Não | Por data de publicação no diário (D+1) |
| Drenar agora (one-off pós-deploy) | `ConsultarPublicacoes` (fila) | Sim | Esvazia todo o acumulado e confirma |

A partir da próxima execução (manual ou cron), só virão as novas disponibilizadas desde a última passada, todas já confirmadas.

## Fora de escopo
- Lógica de deduplicação (próxima conversa).
- Mudanças de UI além de rótulos/mensagens necessárias.