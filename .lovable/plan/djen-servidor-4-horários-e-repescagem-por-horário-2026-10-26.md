# DJEN Servidor: 4 horários e repescagem por horário

## Por que
Em 23/10, as 3 rodadas automáticas consultaram o TRT24 sem erro, mas o DJEN não devolveu nenhuma publicação. A busca manual de hoje, para o mesmo dia, trouxe 25 publicações por advogado, inclusive a do Dr. Osmar. O DJEN liberou as publicações tarde, e as rodadas seguintes só procuram o dia corrente.

## O que muda na tela (DJEN Servidor > DJEN Termos > Agendamento automático)
- **Até 4 horários por dia.** Hoje o limite é 3. O botão "Adicionar horário" aparece enquanto houver menos de 4.
- Cada horário ganha uma marcação **Normal / Repescagem**:
  - **Normal:** busca o próprio dia, como hoje.
  - **Repescagem:** busca o **último dia anterior em que houve busca normal**. Dias sem busca, como sábado e domingo, nunca são buscados.
- Os dias da semana marcados continuam valendo para todos os horários.
- Na lista de execuções, a rodada de repescagem aparece como **"Repescagem de dd/mm"**.

Exemplo com os horários 04:30, 10:00 e 17:00 em Normal e 23:30 em Repescagem, de segunda a sexta:

| Execução 23h30 | Dia buscado |
|---|---|
| Segunda | Sexta anterior |
| Terça | Segunda |
| Sexta | Quinta |

- Cada dia é repescado **uma única vez**. Se o mesmo dia já foi repescado, a rodada não roda de novo.
- O que já foi capturado não se repete, porque a regra de duplicidade atual continua valendo.
- Os 3 horários atuais continuam como **Normal**. Para ativar a rotina pedida, basta incluir o 23:30 marcado como **Repescagem**. Posso já deixar assim configurado.

## Detalhes técnicos
- Configuração: `configuracoes_monitoramento_servidor` (tipo `djen_paralela_servidor`); `horarios_execucao` passa a aceitar até 4 itens. O modo de cada horário fica em `metadata.modos_horarios`, por exemplo `{ "23:30": "repescagem" }`; quando ausente, vale "normal". Não há mudança de estrutura no banco.
- Tela: `src/components/djen/DjenServidorParalelaCard.tsx`, com limite 4 e um seletor Normal/Repescagem por horário, salvando em `metadata`.
- Agendador: `supabase/functions/dispatcher-servidor/index.ts`.
  - **Slot em modo repescagem:** o dia alvo é o maior dia (em Brasília) com execução `djen_paralela_servidor` normal anterior a hoje. O agendador pula se já houver execução com `payload.repescagem = true` e o mesmo `dataInicio`.
  - Enfileira com `{ dataInicio, dataFim: alvo, repescagem: true }`.
  - Também corrige a trava de "um disparo por slot", que hoje compara só a hora e impediria dois horários na mesma hora.
- Motor (`paralela.js`): já aceita `dataInicio`/`dataFim`; não muda.
- Teste Deno do cálculo do dia alvo: segunda → sexta, terça → segunda, dia já repescado → não roda.
