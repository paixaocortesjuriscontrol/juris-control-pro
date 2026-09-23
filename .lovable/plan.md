# Publicações antigas reaparecendo como "capturadas hoje" na Análise DJEN

## O que está acontecendo (confirmado)

As duas publicações da imagem (0000161-74.2026.5.10.0008, disponibilizada em 21/07/2026, e 0000678-70.2026.5.10.0011, disponibilizada em 14/07/2026) **não foram buscadas novamente hoje**. O sistema não faz busca retroativa.

O que ocorreu: alguém da coordenação da Dra. Janaina abriu, na Análise DJEN, publicações antigas que já existiam (elas chegaram pelo acompanhamento do advogado/parte) e usou a ação de vincular/criar item a partir delas. Nesse momento o sistema grava uma **cópia** da publicação na aba "Pub. DJEN" do processo. Essa cópia:

- é gravada com a data de hoje como data de captura (23/09/2026, entre 07h36 e 09h38 BRT — 17 cópias no total hoje, todas dessa coordenação);
- entra na lista de "Processo Cadastrado" como se fosse uma captura nova de hoje;
- não mostra o termo encontrado, porque a cópia guarda apenas o processo — ela perde a ligação com o monitoramento (advogado/parte) que originalmente encontrou a publicação.

Ou seja: são duplicatas visuais de publicações antigas, não capturas retroativas.

## O que será feito

1. Ao gravar a cópia da publicação no processo, preservar a data de captura original (a data em que a publicação realmente foi encontrada) em vez de usar a data de hoje. Assim ela deixa de aparecer como novidade do dia.
2. Preservar também a origem (o monitoramento/termo que encontrou a publicação), para que a lista volte a exibir o termo encontrado nessas publicações.
3. Corrigir as 17 cópias criadas hoje nessa coordenação, devolvendo a data de captura e o termo corretos — nada é apagado.

Nenhuma regra de busca é alterada e nenhuma publicação é excluída.

## Detalhes técnicos

- Origem: `salvarPublicacaoNoProcesso` em `src/lib/ensureProcessoFromPublicacao.ts` (linhas 61-83) monta a cópia sem `created_at`/`data_encontrado`, então o default `now()` da tabela `publicacoes_djen_processos` assume; e a tabela não tem coluna de monitoramento, daí a ausência do badge de termo.
- Ajustes:
  - Incluir na `row` os campos `created_at: original?.created_at`, `data_encontrado: original?.data_encontrado ?? original?.created_at` e `data_publicacao`/`data_disponibilizacao` já existentes.
  - Migração: adicionar `monitoramento_id uuid` (nullable, FK opcional para `monitoramentos_djen`) em `publicacoes_djen_processos`, preencher na cópia com `original?.monitoramento_id`, e expor o campo em `usePublicacoesDjenUnificadas.ts` (select da query de processos) para o badge de termo funcionar igual às publicações de termo.
  - Backfill pontual: nas 17 linhas de hoje (`fonte='servidor'`, `created_at::date='2026-09-23'`, coordenação `9d4e11e2-...`), reatribuir `created_at`/`data_encontrado` e `monitoramento_id` a partir da publicação de origem, casando por `id_djen` + `coordenacao_id` em `publicacoes_djen`/`publicacoes_djen_servidor`.
- Alternativa mais simples, se preferir: em vez de gravar cópia, apenas vincular o `processo_id` na publicação original e fazer a aba "Pub. DJEN" do processo ler também `publicacoes_djen`. Elimina a duplicata de vez, mas altera a leitura da aba em vários pontos (`ProcessoDetalhes.tsx`, `PublicacoesDjenList.tsx`, vínculos de tarefa/prazo/audiência).
