# Repescagem diária do DJEN Servidor às 23h30

## Por que
Em 23/10, as 3 rodadas automáticas (04h30, 10h00 e 17h00) consultaram o TRT24 sem erro, mas o DJEN não devolveu nenhuma publicação. A busca manual de hoje, para o mesmo dia, trouxe 25 publicações por advogado, entre elas a do Dr. Osmar. O DJEN liberou as publicações do TRT24 tarde, e as rodadas seguintes só procuram o dia corrente.

## Como vai funcionar
- **Todo dia às 23h30 (Brasília)**, o DJEN Servidor faz uma busca completa: todos os termos, todos os tribunais e todas as coordenações.
- **Dia buscado:** o último dia **anterior** em que houve busca automática. Os dias sem rodada, como sábado e domingo, nunca são buscados.

| Execução 23h30 | Dia buscado |
|---|---|
| Terça | Segunda |
| Sábado | Sexta |
| Domingo e segunda | Sexta (só se ainda não tiver sido repescada no sábado; se já foi, não roda) |

- Cada dia é repescado **uma única vez**.
- O que já foi capturado não se repete, porque a regra de duplicidade atual continua valendo. Só entram as publicações que tinham ficado de fora.
- Na tela de execuções, a rodada aparece como **"Repescagem de dd/mm"**.
- Nada muda nos horários atuais (04h30, 10h00 e 17h00, de segunda a sexta).

## Detalhes técnicos
- `supabase/functions/dispatcher-servidor/index.ts`: novo bloco para `djen_paralela_servidor` às 23h30 SP, todos os dias da semana.
  - O dia alvo é o maior `date(agendado_para em BRT)` das execuções `djen_paralela_servidor` anteriores a hoje sem `payload.repescagem`.
  - O bloco pula a execução se já existir uma com `payload.repescagem = true` e `payload.dataInicio` igual ao alvo.
  - Enfileira com `p_payload: { dataInicio: alvo, dataFim: alvo, repescagem: true }` e `p_slot: "23:30"`.
- O motor (`paralela.js`) já aceita `dataInicio`/`dataFim` no payload; não muda.
- O horário 23h30 fica em `configuracoes_monitoramento_servidor.metadata.repescagem_horario` (padrão "23:30"), para poder ser ajustado depois sem código.
- Mostrar o rótulo "Repescagem" no card de execuções (`DjenServidorParalelaCard.tsx`) quando `payload.repescagem`.
- Teste Deno do cálculo do dia alvo: segunda → sexta; terça → segunda; domingo com sexta já repescada → não roda.
