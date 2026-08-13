# Acompanhamento Especial: frequência e detecção de novidades

## O que está acontecendo hoje

**Frequência (confirmado):** existem 3 cron jobs (10h, 14h e 18h BRT). O slot 10 roda processos com frequência >= 1, o slot 14 só frequência >= 3 e o slot 18 só frequência >= 2. Todos os 28 processos em acompanhamento especial estão com frequência 1, ou seja, hoje já são consultados **uma vez por dia**. O problema não foi consulta em excesso: quando a execução das 10h travava, o processo simplesmente não era checado naquele dia, porque não existe retomada.

**"Novidade por identidade do step":** hoje a detecção compara apenas datas. O sistema guarda em `acompanhamento_ultimo_step_date` a data do andamento mais recente já visto e ignora qualquer andamento com data menor ou igual. Como os tribunais e a Judit frequentemente publicam andamentos com data retroativa (uma sentença de 09/08 aparecendo depois de um andamento de 12/08), esses andamentos novos são descartados sem nenhum aviso.

"Identidade do step" significa decidir se é novidade pelo **identificador do andamento** (`step_id` da Judit, ou uma assinatura data + conteúdo quando não houver id), e não pela data. A tabela `acompanhamento_especial_eventos` já tem `step_id` com restrição de unicidade: se aquele step ainda não existe para o processo, é novidade e avisa — mesmo com data antiga. Se já existe, o registro é rejeitado pela unicidade e nada é avisado, sem risco de e-mail repetido.

## Mudanças propostas

1. **Detecção por identidade do step**
   - Remover o filtro por data e tentar registrar todos os steps retornados; o unique de `step_id` faz a deduplicação.
   - Manter `acompanhamento_ultimo_step_date` apenas como informação de referência, não como filtro.
   - Manter o comportamento de primeira execução: gravar todos os steps como baseline silencioso (sem e-mail), para não disparar centenas de avisos no primeiro dia.
   - Nos avisos, quando a data do andamento for anterior à última já conhecida, sinalizar como "andamento retroativo" no e-mail e na notificação.

2. **Respeitar exatamente a frequência configurada**
   - Regra explícita: frequência 1 = só slot 10; frequência 2 = slots 10 e 18; frequência 3 = slots 10, 14 e 18. Nada além disso.
   - Manter a guarda anti-duplicidade por dia/slot já existente.

3. **Execuções travadas**
   - Marcar como `erro` as execuções presas em `executando` há mais de 30 minutos, liberando o processo.
   - Nos slots seguintes, permitir retomada apenas dos processos que **não foram checados com sucesso no dia**, para que uma falha às 10h não deixe o processo sem nenhuma checagem.

## Detalhes técnicos

- Arquivo: `supabase/functions/judit-acompanhamento-especial/index.ts` (loop de steps, ~linhas 611-674, e filtro de slot, ~linhas 460-485).
- Deduplicação: unique (`processo_id`, `step_id`) em `acompanhamento_especial_eventos`; quando a Judit não enviar id, usar assinatura `data + conteúdo`.
- Sem alteração de schema prevista.