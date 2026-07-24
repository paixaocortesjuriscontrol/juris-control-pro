
## Objetivo
Anexos Judit passam a ser estritamente opt-in por clique. Nenhum código, edge function ou fluxo automático envia `com_anexos: true` sem que o usuário tenha marcado o checkbox no exato clique. Toda chamada cobrada da Judit passa a ser rastreável em `judit_logs`.

## 1. Callsites hardcoded `com_anexos: true` sem checkbox → `false`

- `src/components/processos/ProcessoFormDialog.tsx:669` — botão "Buscar Judit" do dialog de criação/edição. Passa a `com_anexos: false`. Quem precisa de anexos usa o formulário completo do processo (aba Análise Judit), que já tem checkbox.
- `src/components/distribuicao-tst/DossiesNaoLocalizadosButton.tsx:116` — loop "Consultar Judit e preencher Dados Benner". Passa a `com_anexos: false`. Sem checkbox no dialog.
- `src/pages/DistribuicaoTst.tsx` — remover estado `bulkComAnexos` (167-168), checkbox da UI (~1907) e forçar `com_anexos: false` no envio bulk (1159, 1187). A opção continua existindo dentro do formulário do processo/distribuição.

## 2. Auto-fires escondidos — removidos

- `src/components/distribuicao-tst/DistribuicaoTstDetail.tsx:172-183` — `reloadAnexos()` invoca `sincronizar-judit-anexos` automaticamente para linhas legadas sem `status`. Remover esse ramo por completo. Sincronização passa a ocorrer só quando o usuário clica em "Sincronizar anexos".
- Backfill único via insert tool: `UPDATE public.judit_anexos SET status = 'done' WHERE status IS NULL AND corrupted IS NOT TRUE;` para que anexos legados não fiquem visualmente escondidos após remover o auto-refresh.
- `supabase/functions/buscar-judit/index.ts:737-744` — no ramo cache-hit dispara `juditCriarRequestComOpcoes(...)` sem `await`, consumindo uma consulta cobrada em segundo plano. Remover. Crawler só é acionado quando o cliente passa `force_refresh: true` ou não há cache utilizável.

## 3. Acompanhamento Especial — respeitar o checkbox existente e logar

O cron já lê `acompanhamento_com_anexos` do processo (`supabase/functions/judit-acompanhamento-especial/index.ts:151`), então essa parte já respeita o clique — mantém como está. O que muda:

- Instrumentar a função para gravar em `judit_logs` cada `GET /lawsuits`, com:
  - `origem: "acompanhamento-especial"`;
  - `tipo_cobranca` = `"com_anexos"` ou `"sem_anexos"` conforme `acompanhamento_com_anexos` do processo;
  - `processo_numero`;
  - `user_email` do dono do processo quando resolúvel via `dados_benner.user_id → profiles.email`; fallback `"cron"`.
- Depois de instrumentado, rodo um `read_query` e devolvo no chat: quantos processos em acompanhamento especial, quantos com anexos, frequência e volume de chamadas por dia nos últimos 30 dias (via `execucoes_acompanhamento_especial`). Se houver algo desproporcional, discutimos separado.

## 4. `sincronizar-judit-anexos` — logar

- `supabase/functions/sincronizar-judit-anexos/index.ts:45` continua enviando `with_attachments: true` (a função só existe para isso e agora só roda por clique).
- Passa a gravar em `judit_logs` com `origem: "sincronizar-anexos"`, `tipo_cobranca: "com_anexos"`, `user_email` do JWT do chamador, `processo_numero`.

## 5. Padrão de log — `judit_logs` inequívoco

Todo `insert` de log passa a incluir explicitamente:
- `origem` (`distribuicao-tst`, `formulario-processo`, `dossies-nao-localizados`, `sincronizar-anexos`, `acompanhamento-especial`, etc.);
- `tipo_cobranca` (`"com_anexos"` ou `"sem_anexos"`);
- `user_email` do JWT quando houver.

Sem alteração de schema — colunas já existem.

## Ordem de execução
1. Frontend: `DistribuicaoTst.tsx`, `ProcessoFormDialog.tsx`, `DossiesNaoLocalizadosButton.tsx`, `DistribuicaoTstDetail.tsx`.
2. Edge functions: `buscar-judit` (remover refresh oculto), `sincronizar-judit-anexos` (logar), `judit-acompanhamento-especial` (logar). Deploy.
3. Insert tool: backfill `judit_anexos.status`.
4. `read_query` + entrega no chat do relatório do acompanhamento especial.
5. Bump versão para 4.2.7.

## Fora de escopo
- Nenhuma mudança nos checkboxes existentes (formulário TST, aba Análise Judit do processo, aba Partes do Benner) — todos já são opt-in.
- Nenhuma mudança na frequência do cron `judit-acompanhamento-especial` — apenas medição.
