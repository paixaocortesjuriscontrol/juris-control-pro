## Problema

Para o processo `0001695-95.2013.5.01.0481` (TST), a Judit retorna corretamente todas as instâncias e movimentos, mas a edge function `buscar-judit` está usando:

- `distribution_date` da capa = **10/10/2022** (data original no TRT1, não a do TST)
- `judge.name` = **Luiz José Dezena da Silva** (último gabinete da capa, certo por coincidência)

Os steps mostram a história real no TST:
- 30/11/2022 → Distribuição inicial Min. Luiz José Dezena
- **10/12/2025** → Redistribuição para PRESIDÊNCIA
- **05/03/2026** → Redistribuição (incompetência) → Min. Luiz José Dezena (8ª Turma) ← **última distribuição válida**

A regra que você definiu: **sempre usar a última distribuição/redistribuição para Gabinete de Ministro** no TST, ignorando passagens por Presidência/Vice/Corregedoria como ponto final.

## Solução

Adicionar à edge function `supabase/functions/buscar-judit/index.ts` uma rotina específica para TST que percorre os `steps` e detecta a última distribuição efetiva ao Gabinete de Ministro.

### 1. Nova função `extrairUltimaDistribuicaoTst(steps)`

- Percorre os `steps` em ordem cronológica decrescente.
- Considera apenas movimentos cujo `code` CNJ seja **26 (Distribuição)**, **36 (Redistribuição)** ou cujo `content/title` contenha "Distribuição" / "Redistribuição".
- Para cada candidato, lê o órgão julgador no campo `orgao_julgador.nome` ou extrai do final do `content` (após o último " - ").
- **Aceita só se o órgão for Gabinete de Ministro** — descarta órgãos cujo nome bate em `/PRESID[ÊE]NCIA|VICE[\s-]?PRESID|CORREGEDORIA/i`.
- Retorna `{ data, relator, turma, orgao }` do primeiro que casar (= o mais recente).
- Extrai relator do padrão `GAB(?:INETE|\.)\s+D[OA]\s+MINISTR[OA]?\s+(.+)` no nome do órgão.
- Deriva turma via `derivarTurmaDoRelator(relator)` (mapeamento determinístico TST já existente em `_shared/extrair-relator.ts`).

### 2. Aplicar quando `tribunal === "TST"`

No bloco de extração final (após linha ~1088, onde já existe a "CORREÇÃO TURMA TST"), antes da sanitização:

```ts
if (tribunal === "TST") {
  const ultima = extrairUltimaDistribuicaoTst(steps);
  if (ultima) {
    if (ultima.data) {
      // Sobrescreve distribution_date pela data da última (re)distribuição ao gabinete
      rd.distribution_date = ultima.data;
    }
    if (ultima.relator) relator = ultima.relator;
    if (ultima.turma) turma = ultima.turma;
    console.log(`[buscar-judit] última distribuição TST: ${ultima.data} -> ${ultima.relator} (${ultima.turma})`);
  }
}
```

E recomputar `dataDistribuicaoBR` / `dataDistribuicaoISO` a partir do `rd.distribution_date` atualizado.

### 3. Manter fallbacks atuais

- Se não houver step de (Re)distribuição para Gabinete de Ministro nos steps (caso raro de capa-only), mantém o comportamento atual (usa `distribution_date` + `judge` da capa).
- DataJud continua como fallback para casos em que a Judit não retorna instância TST (já implementado nas linhas 965-1024).

### 4. Validação manual após deploy

Disparar a função para `0001695-95.2013.5.01.0481` com `tribunal=TST` e conferir no retorno:
- `data_distribuicao` = `2026-03-05`
- `relator` = `LUIZ JOSE DEZENA DA SILVA`
- `turma` = `8ª Turma`

Conferir também um processo de controle onde a redistribuição mudou de gabinete, para garantir que turma muda junto com relator.

### 5. Atualizar memória

Adicionar memory `mem://logic/judit/tst-ultima-redistribuicao` documentando a regra: para TST, `relator/turma/data_distribuicao` vêm SEMPRE do último step de Distribuição/Redistribuição cujo órgão seja Gabinete de Ministro (Presidência/Vice/Corregedoria não contam).

## Arquivos alterados

- `supabase/functions/buscar-judit/index.ts` — adicionar `extrairUltimaDistribuicaoTst()` e chamada no bloco TST
- `mem/logic/judit/tst-ultima-redistribuicao.md` (novo)
- `mem/index.md` — adicionar referência

## Fora do escopo

- Não altera a UI; o fluxo continua sendo: usuário clica "Buscar Judit" no formulário → função retorna os dados corrigidos → frontend aplica via `pickJuditOnly`/`applyJuditOnly` (memory `Judit Resource Attribution Rules`).
- Não atualiza retroativamente registros já salvos no `dados_benner` — você precisa reabrir cada processo e clicar em "Buscar Judit" novamente para corrigir. Se quiser um reprocessamento em lote depois, abro como tarefa separada.
