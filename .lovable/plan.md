# Ranking: crédito por quem executou e contagem de publicações

## Como funciona hoje
- Um item concluído conta para **todos** os responsáveis e envolvidos dele, e não para quem deu a baixa.
- O sistema guarda só o **nome** de quem concluiu. Não há um campo que diga quem executou de fato.
- A leitura e o descarte de publicações na Análise DJEN ficam registrados por pessoa, mas não entram no ranking.

## O que muda

### 1. Quem executou e quem revisou
- O aviso "Dar baixa" (Painel de controle, Agenda e ficha do processo) ganha dois campos:
  - **Quem executou**: obrigatório. Vem preenchido com o responsável principal e pode ser trocado.
  - **Quem revisou/corrigiu**: opcional, aceita mais de uma pessoa.
- O sistema grava também quem clicou em baixar, para histórico.
- No ranking, as colunas Concluídos, No prazo e Com atraso passam a contar só para **quem executou**.
- Nova coluna **Revisões**: conta os itens que a pessoa revisou ou corrigiu.
- Prazos perdidos continuam contando para os responsáveis.
- Itens concluídos antes desta mudança seguem a regra atual: contam para responsáveis e envolvidos.

### 2. Publicações tratadas
- Nova coluna **Publicações**: quantas publicações cada pessoa marcou como lidas ou descartou no período.
  - Se a mesma pessoa ler e descartar a mesma publicação, conta uma vez só.
- Essa coluna aparece separada e não altera a nota de prazos. Ela também aparece na aba Produtividade e no relatório PDF/Excel.
- Os filtros de coordenação e de pessoa do ranking também valem para essa coluna.

## Detalhes técnicos
- Migração em `tarefas`: `executado_por uuid`, `baixado_por uuid` e `revisado_por uuid[]`, sem chave estrangeira para auth.users.
- O `BaixaRapidaDialog` e as demais telas de baixa gravam esses campos. O trigger de auditoria já registra a mudança.
- `get_ranking_atendimento_geral` e `_tst`:
  - Em `concl`, o crédito vai para `executado_por` quando ele estiver preenchido. Sem ele, vale a regra atual (`tar_resp`).
  - Novo CTE `revisoes` (unnest de `revisado_por`).
  - Novo CTE `publicacoes`: `publicacoes_djen_leituras` (por `lida_em`) somado a `publicacoes_djen_descartadas` (por `descartado_por` e `created_at`), distinto por publicação.
  - Duas colunas novas no retorno: `revisoes` e `publicacoes_tratadas`.
- `RankingAtendimento.tsx`: novas colunas na tela e nas exportações.
