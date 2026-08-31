# Distribuição TST: corrigir "Prontos" e "A fazer"

## O que aconteceu (confirmado no banco)

Hoje (31/08) a geração da Carga Benner mudou **981 registros** de `pronto_envio` para `planilhado` (e 660 passaram de `rascunho` para `pronto_envio`).

Os totalizadores só conhecem dois estados:

- **Prontos** conta apenas `status = 'pronto_envio'` → hoje 830.
- **A fazer** exclui apenas `status = 'pronto_envio'` → por isso os 981 `planilhado` (e o registro `enviado`) **voltaram a ser contados como "A fazer"**.

Números atuais (registros com aba de origem): rascunho 13.559, planilhado 981, pronto_envio 830, enviado 1. "A fazer" hoje = 13.615, dos quais 981 são processos já concluídos e planilhados na carga.

Ou seja: a cada geração de carga, os processos finalizados desaparecem de "Prontos" e reaparecem em "A fazer" — foi exatamente o que a coordenadora percebeu.

## Correção

1. **"A fazer" passa a ignorar todos os status de conclusão**: `pronto_envio`, `planilhado` e `enviado` (hoje só ignora `pronto_envio`). Vale para o card, para o filtro "A fazer" da lista e para o relatório "Total por Situação".
2. **"Prontos"** passa a contar os concluídos (`pronto_envio` + `planilhado` + `enviado`), com o detalhe no tooltip/subtítulo do card ("X prontos, Y planilhados, Z enviados"), para o número não cair de novo quando a carga é gerada.
3. **"Pronto sem pendência"** passa a considerar também `planilhado`/`enviado`, mantendo o mesmo cálculo de pendências.
4. O clique nos cards continua aplicando o filtro equivalente na lista, agora coerente com a nova regra.

## Detalhes técnicos

- Banco (migração `CREATE OR REPLACE`): `get_distribuicao_tst_stats` e `get_distribuicao_tst_situacao_totais` — no ramo `v_situacao = 'a_fazer'` e nas agregações `a_fazer`, trocar `status <> 'pronto_envio'` por `status NOT IN ('pronto_envio','planilhado','enviado')`; `pronto_envio` (card Prontos) passa a somar os três status, com colunas separadas para o detalhamento.
- `src/hooks/useDistribuicoesTst.ts`: os três blocos de query (lista, contagem e `fetchAllDistribuicaoTstIds`) no ramo `a_fazer` passam a excluir os três status; novo tratamento para o filtro de "prontos/concluídos".
- `src/hooks/useDistribuicaoTstStats.ts` e `src/components/distribuicao-tst/TotalPorSituacaoCard.tsx`: mesma regra no cálculo local (usado quando há muitos IDs filtrados).
- `src/hooks/useProntoSemPendenciaCount.ts`: `.eq("status","pronto_envio")` vira `.in("status", ["pronto_envio","planilhado","enviado"])`.
- `src/pages/DistribuicaoTst.tsx`: rótulo/tooltip do card Prontos e mapeamento card → filtro.

## Verificação

Depois do ajuste, "A fazer" deve cair de 13.615 para ~12.634 e "Prontos" mostrar 1.812 (830 prontos + 981 planilhados + 1 enviado); gerar uma nova carga não deve mais mover processos de "Prontos" para "A fazer".
