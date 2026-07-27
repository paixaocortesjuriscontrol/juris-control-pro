## Diagnóstico (confirmado)

O processo existe: há **14 publicações** em `publicacoes_djen` com `dedup_processo_digits = 56906950720258090051` (fontes TJGO, servidor e kurier, em 7 coordenações/datas diferentes) — exatamente o número mostrado nos cards.

A causa da lista vazia é **timeout da RPC de listagem**, não ausência de dados:

- `get_djen_publicacoes_unificadas` tem `SET statement_timeout = '20s'`.
- Executei o predicado de busca dessa RPC no banco: **21,4 s** (Seq Scan em `publicacoes_djen`, 143.873 linhas, `ILIKE '%...%'` em `conteudo`, `advogados_json::text`, `partes_json::text` etc.).
- `get_djen_stats_per_user` (cards) usa `statement_timeout = '25s'` e um predicado mais leve, então **conclui** e mostra 14.

Resultado: cards contam 14, a lista estoura o limite de 20 s e volta vazia.

## O que fazer

### 1. Caminho rápido para busca por número de processo (principal)
Nas RPCs `get_djen_publicacoes_unificadas`, `count_djen_publicacoes_unificadas`, `get_djen_stats_per_user` e `get_djen_descartadas_dedup`:

- Se o termo digitado tiver **≥ 11 dígitos** (número CNJ), pesquisar **apenas por dígitos do processo** usando as colunas já normalizadas (`dedup_processo_digits`, com fallback para `regexp_replace(processo_numero…)`), com comparação por igualdade/prefixo — sem varrer `conteudo`, `partes_json` e `advogados_json`.
- Se o termo for texto (busca por palavra/parte/advogado), manter o comportamento atual.

### 2. Índices de apoio
- `CREATE INDEX ... ON public.publicacoes_djen (dedup_processo_digits)` e equivalente em `publicacoes_djen_processos` / `publicacoes_djen_descartadas`.
- Extensão `pg_trgm` + índice GIN em `conteudo` para acelerar a busca textual livre (`ILIKE '%texto%'`), que hoje também é Seq Scan.

### 3. Salvaguardas
- Elevar `statement_timeout` da RPC de listagem de 20 s para 30 s (rede de segurança; após o item 1 a consulta deve cair para milissegundos).
- No hook `src/hooks/usePublicacoesDjenUnificadas.ts`, quando a RPC falhar por timeout (`57014`), exibir aviso claro na tela em vez de renderizar "Nenhuma publicação encontrada" silenciosamente.

## Validação
Reexecutar o mesmo predicado no banco após os índices e medir o tempo, e conferir na tela Análise DJEN que a busca por `5690695-07.2025.8.09.0051` lista as 14 publicações (batendo com os cards).

## Detalhes técnicos
Alterações: uma migração SQL (índices + redefinição das quatro funções) e ajuste pontual de tratamento de erro no hook de listagem. Nenhuma mudança de layout ou de regra de negócio de captura DJEN.
