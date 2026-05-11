## Objetivo

Substituir a classificação por IA (Claude) do botão **"Docs TST (IA)"** por **regras determinísticas por palavra-chave**, e expandir de 3 para **5 categorias** de documentos. Mais rápido, mais barato, mais previsível — e elimina a única exceção do projeto que ainda usava Anthropic.

O botão será renomeado para **"Docs TST"** (sem o "(IA)").

## Categorias e regras (case-insensitive, sem acentos)

Aplicadas **na ordem abaixo** — a primeira que casar vence.

| # | Categoria | Regra de match | Conteúdo no Word |
|---|---|---|---|
| 1 | **TEMAS_IRR** | Texto contém (`sobrestamento` OU `sobrestar`) **E** (`tema` seguido de número OU `tema vinculante` OU `IncJulgRREmbRep`) | Conteúdo integral + badge amarela com `Tema XX` quando identificável |
| 2 | **PAUTA** | Texto contém `pauta de julgamento` | Conteúdo integral |
| 3 | **CEJUSC** *(novo)* | Texto contém `plataforma zoom` | Conteúdo integral |
| 4 | **DISTRIBUIÇÕES** *(novo)* | Texto contém `lista de distribuição` | Conteúdo integral |
| 5 | **PRAZOS** *(default)* | Tudo que sobrar | Apenas as **últimas 20 linhas** do conteúdo (linhas vazias colapsadas, mantendo formatação básica) |

## Arquivos gerados

Até 5 arquivos `.docx`, um por categoria que tenha pelo menos 1 publicação:

- `TEMAS_IRR_<dd.MM.yy>.docx`
- `PAUTA_<dd.MM.yy>.docx`
- `CEJUSC_<dd.MM.yy>.docx`
- `DISTRIBUICOES_<dd.MM.yy>.docx`
- `PRAZOS_<dd.MM.yy>.docx`

Mantemos a estrutura visual atual (cabeçalho azul COMUNICAÇÃO PJE, metadados, link Inteiro Teor para o PJe Comunica, partes/advogados, comentários).

## Mudanças técnicas

### 1. Frontend — `src/pages/AnaliseDjen.tsx` (`handleGerarDocsTST`)
- Remover o loop que chama `supabase.functions.invoke('classificar-publicacoes-tst')`.
- Implementar `classificarLocal(pub)` puramente client-side com as 5 regras acima.
- Para PRAZOS: aplicar helper `pegarUltimasNLinhas(conteudo, 20)` antes de chamar `buildConteudoParagraphs(...)`.
- Adicionar 2 buckets novos (CEJUSC, DISTRIBUIÇÕES) e 2 chamadas a `dl(mkDoc(...))`.
- Atualizar toast de progresso/sucesso para listar as 5 contagens.
- Renomear o label do botão para `"Docs TST"` (linha 2852).

### 2. Edge Function — `supabase/functions/classificar-publicacoes-tst/`
- **Marcar como deprecada** (manter o arquivo por compatibilidade caso seja chamada de outro lugar, mas não é mais usada). Sem deploy/delete imediato.
- Após validação, podemos removê-la em uma limpeza futura — não há outras chamadas no código (verificado: só o `AnaliseDjen.tsx` invoca).

### 3. Memória do projeto
- Atualizar `mem://features/analise-djen/tst-ai-automated-docs` para refletir: regras determinísticas, 5 categorias, sem IA, sem Anthropic.

## Pontos confirmados pela advogada
- **Sem keyword → PRAZOS** (default).
- **Ordem de prioridade**: TEMAS IRR > PAUTA > CEJUSC > DISTRIBUIÇÕES > PRAZOS.
- **TEMAS IRR**: precisa de `sobrestamento`/`sobrestar` **E** menção a `Tema`.

## Detalhes do recorte das últimas 20 linhas (PRAZOS)
- Limpar HTML (`<br>` → quebra, strip de tags).
- Quebrar por `\n`, remover linhas em branco redundantes.
- Pegar as últimas 20 linhas não-vazias.
- Se a publicação tiver menos de 20 linhas, usa tudo.
- Renderizar com o mesmo estilo de `buildConteudoParagraphs("Trecho final da decisão (últimas 20 linhas)")`.

## Riscos / observações
- Publicações com texto único sem quebras de linha (tudo em um parágrafo) terão "1 linha" → todo o conteúdo entra. Aceitável para um corte determinístico.
- Se aparecerem novas variações de keywords no futuro (ex.: `"PLATAFORMA Zoom"` com Z maiúsculo no meio), o match já é case-insensitive, então cobre. Mas variações como "Sala virtual Zoom" sem "plataforma" não casam — precisaria revisão.
- Sem IA, não há mais geração de "resumo analítico" para PRAZOS — agora é literalmente o trecho final do texto.