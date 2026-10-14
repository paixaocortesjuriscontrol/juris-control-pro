# Ranking: contar publicações tratadas

## Como funciona hoje
A leitura e o descarte de publicações na Análise DJEN ficam registrados por pessoa, mas não aparecem no ranking.

## O que muda
- Nova coluna **Publicações** no ranking. Ela mostra quantas publicações cada pessoa marcou como lidas ou descartou no período.
  - Se a mesma pessoa ler e descartar a mesma publicação, conta uma vez só.
- A coluna fica separada: não muda a nota de prazos nem os itens concluídos.
- Ela aparece também na aba Produtividade e nos relatórios em PDF e Excel.
- Os filtros de período, coordenação e pessoa do ranking também valem para ela.
- Quem só leu publicações no período também entra na lista do ranking.
- A regra de crédito das conclusões continua como está hoje.

## Detalhes técnicos
- Atualizar `get_ranking_atendimento_geral` e `get_ranking_atendimento_tst`:
  - Novo CTE `publicacoes`: une `publicacoes_djen_leituras` (`usuario_id`, `lida_em`) com `publicacoes_djen_descartadas` (`descartado_por`, `created_at`), conta publicações distintas por usuário e filtra pelas datas do período em horário de Brasília.
  - O filtro de coordenação usa a coordenação da publicação.
  - O usuário entra em `ids`, e o resultado ganha a coluna `publicacoes_tratadas`.
- Em `RankingAtendimento.tsx`, a coluna é adicionada à tabela, à aba Produtividade e às exportações.
