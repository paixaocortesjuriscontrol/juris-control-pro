## Objetivo

Na tela **Análise DJEN**, criar um campo de busca dedicado que filtre pelo texto do conteúdo da publicação, independente do campo atual "Termo, processo..." (que continuará buscando apenas por número de processo e termo do monitoramento).

## Mudanças

### UI — `src/pages/AnaliseDjen.tsx`
- Novo estado `buscaConteudo` + debounce `buscaConteudoDebounced` (350ms), espelhando o padrão do `termoBusca` atual.
- Renderizar, ao lado do campo "Buscar", uma segunda caixa com label **"Buscar no conteúdo"** e placeholder `Palavra ou frase no texto…`, com ícone de lupa e botão "x" para limpar.
- Incluir `buscaConteudoDebounced` em todas as `queryKey` e nos filtros passados para:
  - `usePublicacoesDjenUnificadas` (novo parâmetro `buscaConteudo`)
  - contagem Kurier server-side
  - queries do DataJud e Pautas DEJT
  - RPC de descartadas dedup (novo parâmetro `p_conteudo_query`)
- Ao clicar em qualquer célula do calendário / botão "Limpar filtros", limpar também esse campo.

### Restrição do campo atual — `src/pages/AnaliseDjen.tsx` + `src/hooks/usePublicacoesDjenUnificadas.ts`
- O campo original "Termo, processo..." passa a filtrar somente por: `numero_processo` (dígitos) e `monitoramento_termo/descricao`, deixando de aplicar `ilike` sobre `conteudo`.
- O novo campo é o único que aplica `ilike '%texto%'` em `conteudo` (e em `complemento/tipo_movimentacao/assuntos` no DataJud e nos campos de texto de Pautas DEJT).

### Hook — `src/hooks/usePublicacoesDjenUnificadas.ts`
- Adicionar `buscaConteudo?: string` à interface de filtros.
- Propagar como novo parâmetro para as RPCs unificadas (`p_conteudo_query`) e aplicar client-side onde a filtragem já é feita em memória (blocos ~987, 1097, 1190).

### Backend — nova migration
- Atualizar as funções `get_djen_publicacoes_unificadas` e `get_djen_descartadas_dedup` adicionando parâmetro `p_conteudo_query text DEFAULT NULL` que aplica `conteudo ILIKE '%' || p_conteudo_query || '%'` quando informado. `p_search_query` deixa de tocar em `conteudo` e passa a cobrir só número de processo / termo do monitoramento.
- Preservar assinaturas antigas via `DEFAULT NULL` para não quebrar chamadas em cache.

## Comportamento final

```text
[ Buscar ]                [ Buscar no conteúdo ]
 Termo, processo…          Palavra ou frase no texto…
```

- Preencher só o primeiro → filtra por processo/termo do monitoramento (sem varrer o texto).
- Preencher só o segundo → filtra por palavra dentro do conteúdo.
- Preencher ambos → aplica os dois filtros em AND.
- "Limpar filtros" e clique no calendário zeram os dois.

## Fora de escopo
- Highlight das ocorrências no texto e busca com operadores AND/OR/aspas (podem ser feitos em próximo passo se necessário).
