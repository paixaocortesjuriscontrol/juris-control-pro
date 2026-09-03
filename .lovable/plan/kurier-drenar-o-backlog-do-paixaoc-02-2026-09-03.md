# Kurier: drenar o backlog do paixaoc.02

## O que os dados mostram

Consultei o banco antes de propor qualquer coisa:

- Dos 11 logins ativos, **10 terminam com "0 novas, 0 dup, 0 confirm"** — fila vazia. Só o `paixaoc.02` continua trazendo publicação a cada rodada.
- Hoje o `paixaoc.02` já recebeu **1.410 publicações** (contra 4.278 do `paixaoc`, que esvaziou de manhã), e todas foram confirmadas na Kurier (nenhuma pendente).
- Na execução atual ele está em **8 lotes** com "70 novas, 210 dup" — ou seja, a maior parte do que vem já existe, trazida por outro login.
- Na execução anterior a mensagem dele parou em **"Limite do servidor; retomando em 1×10..."**: depois de um erro de limite o tamanho do lote cai para 10 e **não volta a crescer**, então o backlog é drenado de 10 em 10 itens enquanto os outros logins ficam esperando a vez.

Conclusão: sim, é backlog acumulado nesse login — e o que trava não é o volume em si, é o lote encolhido e o fato de ele dividir as etapas com os outros 10 logins.

## O que vai ser feito

1. **Botão "Drenar fila" por credencial** — na tela de credenciais Kurier (Configurações), cada login ganha um botão que roda **só aquele login**, em etapas curtas encadeadas, até a fila esvaziar. Mostra progresso ao vivo (lotes, recebidas, novas, duplicadas) e permite cancelar.
2. **Processamento normal, sem atalho** — todo item que sai da fila passa pelo fluxo completo de matching e gravação, como hoje. Nada é descartado só para acelerar.
3. **Lote volta a crescer** — depois de um erro de limite o lote cai para 10, mas passa a **subir de novo** (10 → 25 → 50) a cada duas rodadas sem erro. Isso corta drasticamente o número de idas e voltas.
4. **Um login com fila grande não segura os outros** — na execução normal, quando um login continua com fila depois de N etapas, ele passa a ser atendido em paralelo aos demais em vez de bloquear a fila de etapas.
5. **Indicação clara na tela** — quando um login está com fila acumulada, a linha dele mostra "fila acumulada — drenando" em vez de parecer travado.

## Detalhes técnicos

- `supabase/functions/executar-kurier-agendado/index.ts`:
  - `processHop` aceita `only_credencial_id` (modo drenagem): monta `tracks` com uma credencial só e encadeia etapas até `fila_vazia`.
  - Recuperação de lote: após `MAX_LIMIT_ERRORS` zerado e 2 hops sem erro, `loteSize` sobe por degraus (`10 → 25 → 50`) e `maxLotes` volta a `DEFAULT_MAX_LOTES`; qualquer 546/503/504 volta a `MIN_LOTE_SIZE`.
  - `state.opts.drain = true` faz `saveState` marcar `detalhes.modo = "drenagem"` e a track receber `mensagem = "Fila acumulada — drenando"`.
  - Prioridade: track com `lotes >= 6` e ainda `status = "executando"` recebe hops consecutivos (não volta ao fim do round-robin).
- `supabase/functions/kurier-consultar-publicacoes/index.ts`: sem mudança de regra; apenas devolve no retorno `recebidas_da_api` para o orquestrador decidir se pode subir o lote.
- `src/components/configuracoes/KurierCredenciaisPanel.tsx`: botão "Drenar fila" por linha, chamando `executar-kurier-agendado` com `{ credencial_id, drain: true }`.
- `src/hooks/useDjenTermosKurierEngine.ts`: reaproveita o polling existente (`execucoes_agendadas`, heartbeat de 3 min) para o modo drenagem, exibindo a credencial única em foco.
- Sem migração de banco.

## Fora de escopo

- Nenhuma alteração no `monitor-servidor`.
- Nada de confirmar item sem processar (decisão já tomada: processar tudo normalmente).
