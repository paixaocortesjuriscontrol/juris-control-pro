# Ajuste no tipo de recurso da Judit: "Agravo de Instrumento"

## Contexto
A advogada informou que, ao identificar a sigla AI / AIRR, o sistema deve gravar o tipo de recurso como **"Agravo de Instrumento"** (forma curta), e não como **"Agravo de Instrumento em Recurso de Revista"** (forma longa). Atualmente a Edge Function `buscar-judit` ainda devolve a forma longa; o front-end depois normaliza para a curta, mas o dado vindo da Judit já deve chegar correto.

## O que será alterado
1. **`supabase/functions/buscar-judit/index.ts`**
   - Alterar o mapa `SIGLAS_RECURSO_FULL` para que as siglas `airr`, `aiarr`, `air` e `ai` (contexto TST) devolvam **"Agravo de Instrumento"**.
   - Atualizar o comentário que explica o significado da sigla `ai` no contexto TST.

2. **Implantação**
   - Reimplantar a Edge Function `buscar-judit` para que a alteração passe a valer tanto na consulta individual quanto na consulta em lote (ambas usam a mesma função).

## O que NÃO será alterado
- Nenhuma tabela ou dado histórico será corrigido (a advogada já ajustou o processo citado manualmente).
- Os exemplos de ementas em `supabase/functions/resumir-publicacoes/prompt-agente.ts` são textos literais de publicações e não serão alterados.
- O front-end (`src/lib/juditDistribuicaoTst.ts` e `MultiTipoRecurso.tsx`) já usa "Agravo de Instrumento" nas opções do dropdown e no mapeamento legado; portanto, nenhuma mudança adicional é necessária no UI.

## Resultado esperado
Após o deploy, quando a Judit retornar uma sigla AI/AIRR para um processo do TST, o campo `tipo_recurso_*` será preenchido com **"Agravo de Instrumento"** diretamente, sem passar pela forma longa.
