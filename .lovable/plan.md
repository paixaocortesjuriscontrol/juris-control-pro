# Acompanhamento Especial — diagnóstico e correções

## O que verifiquei agora

A rotina **está rodando**, mas nunca gerou aviso. Dados reais do banco:

- 3 cron jobs ativos: `judit-acomp-especial-10brt` (13h UTC), `14brt` (17h UTC), `18brt` (21h UTC).
- Última execução: **hoje 12/08 às 10h BRT**, status `concluido`, 25 processos, 1 erro (`LAWSUIT_NOT_FOUND`).
- 86 execuções registradas, **total de novos eventos = 0** em todas.
- `acompanhamento_especial_eventos`: **0 registros** → nenhuma notificação/e-mail/WhatsApp foi disparado, porque o envio só ocorre quando há novo step.
- `acompanhamento_especial_divergencias`: **105 pendentes** (Judit × formulário) — existem, mas só aparecem no card do Painel de Controle; ninguém é avisado por e-mail.
- Dos 25 processos ativos, **17 voltam com 0 andamentos da Judit** (`acompanhamento_ultimo_step_date` nulo e zero movimentações de fonte judit). Os 8 restantes já têm o histórico gravado e nada novo desde a baseline.
- Todos os 25 estão com frequência 1x/dia → os slots 14h e 18h sempre registram "slot-fora-da-freq" (comportamento esperado).

## Causa

1. **Sem steps na resposta**: a função consulta apenas o endpoint de cache (`GET /lawsuits/{cnj}`). Quando a Judit não tem o processo em cache, retorna sem `steps` (ou `LAWSUIT_NOT_FOUND`) e a rotina não cria requisição de crawler. Resultado: 17 processos nunca terão movimentação nova para avisar.
2. **Baseline silenciosa**: na primeira execução de cada processo, tudo é ignorado (só marca baseline). Correto, mas combinado com o item 1 gera silêncio permanente.
3. **Divergências não notificam**: 105 divergências pendentes sem nenhum canal de aviso.
4. **Zero visibilidade**: não há tela mostrando última execução/erros do acompanhamento especial, então a falha passou semanas sem ser percebida.

## O que vou implementar

1. **Fallback de crawler na Judit** (`judit-acompanhamento-especial`): quando o cache não trouxer `steps` (ou vier `LAWSUIT_NOT_FOUND`), criar requisição de crawler (mesmo padrão já usado em `busca-judit-processos-e-casos`) com polling curto e reaproveitar o payload. Registrar em `judit_logs` a origem do dado (cache ou crawler).
2. **Aviso de divergências por e-mail**: resumo diário (1 e-mail por coordenação/responsável) listando as divergências pendentes do dia, com link para o processo. Sem repetir divergência já avisada (nova coluna `avisado_em`).
3. **Resumo de execução**: quando a execução terminar com processos sem retorno da Judit ou com erro, gravar notificação para o administrador, para que o silêncio nunca mais seja confundido com "nada aconteceu".
4. **Card de status no Painel de Controle — visível para todos os envolvidos**: última execução, slot, processos checados, novos eventos e erros, lendo `execucoes_acompanhamento_especial`. Quem vê:
   - **Admin**: tudo, de todas as coordenações.
   - **Coordenador / assistente coordenador**: os processos das suas coordenações.
   - **Responsável pelo processo** (`processos_responsaveis.ativo`): os processos em que é responsável.
   O botão "Executar agora" fica disponível para admin, coordenador e responsável do processo.
   O card de divergências segue a mesma regra de visibilidade (hoje aberto a todos os autenticados) e passa a filtrar por coordenação/responsabilidade.

## Detalhes técnicos

- Arquivos: `supabase/functions/judit-acompanhamento-especial/index.ts` (fallback crawler + aviso de divergências + notificação de erros), novo componente de status em `src/components/djen/` ao lado de `AcompanhamentoEspecialDivergencias.tsx`.
- Migração: `alter table acompanhamento_especial_divergencias add column avisado_em timestamptz`.
- E-mails via Resend, remetente já usado (`alertas@juriscontrol.adv.br`).
- Nenhuma mudança na regra de preservação: valor digitado pelo advogado continua intocado.

## Observação de custo

O fallback de crawler consome créditos Judit por processo sem cache (até 17 chamadas/dia no cenário atual). Se preferir, limito o fallback a 1x/dia por processo (slot 10h).
