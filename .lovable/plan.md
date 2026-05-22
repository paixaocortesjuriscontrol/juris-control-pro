## Objetivo

Adicionar um novo botão **"Resumo PDF sem repetição"** na tela Análise DJEN, ao lado do botão atual **"Gerar PDF Resumo"** (sem IA — `handleGerarPdfResumoSemIA`, ~linha 2518; é o único ativo hoje, os botões com IA estão desabilitados).

O novo botão produz exatamente o mesmo PDF do "sem IA" (mesmo layout, regras de pauta, trecho final, assinatura/intimados), **mas descartando publicações duplicadas para o mesmo processo** — aquelas que só diferem no bloco final "Destinatário(s): ...".

**Não alterar** a função `handleGerarPdfResumoSemIA` existente. Criar uma função separada e independente.

## Regra de deduplicação

Reutilizar a lógica já existente em `src/utils/djenDedup.ts`:

- `stripDestinatarios(text)` — corta tudo a partir de `Destinatário(s):`.
- Normalização: minúsculas, sem tags HTML, sem pontuação, espaços colapsados (mesmo padrão do `normalizeText` do utilitário).

Chave de dedup:

```
processo_digits (só dígitos do CNJ) + "|" + normalize(stripDestinatarios(conteudo))
```

Em colisão, mantém a publicação com **maior `conteudo.length`** (critério já usado em `dedupePublicacoesDjen`). Publicações sem `processo_numero` são preservadas como estão. Ordem original mantida.

## Mudanças de código

Arquivo principal: `src/pages/AnaliseDjen.tsx`. Também: `src/utils/djenDedup.ts`.

1. **Exportar `stripDestinatarios`** em `src/utils/djenDedup.ts` (hoje é função privada). Sem qualquer outra mudança nesse arquivo — comportamento atual preservado.

2. **Criar helper local** `dedupPubsPorProcessoSemDestinatarios(pubs)` em `AnaliseDjen.tsx`, próximo a `getPubsParaGerar`, importando `stripDestinatarios`. Aplica a chave acima e devolve o array deduplicado, na ordem original.

3. **Criar função nova e independente** `handleGerarPdfResumoSemRepeticao` em `AnaliseDjen.tsx`. Estrutura:
   - É uma **cópia** do corpo atual de `handleGerarPdfResumoSemIA` (linhas ~2518–2704), com duas únicas diferenças:
     - logo após `getPubsParaGerar()`, aplicar `dedupPubsPorProcessoSemDestinatarios(allPublicacoes)`;
     - título do PDF passado para `drawPdfHeader`: `Resumo (sem repetição) de Publicações ${origemLabel}`;
     - toast: `Gerando PDF Resumo sem repetição...` / `PDF Resumo sem repetição gerado!`.
   - Usa um **novo estado** `gerandoResumoSemRepeticao` (não compartilha com `gerandoResumoSemIA`) para que os dois botões funcionem de forma independente.
   - A função `handleGerarPdfResumoSemIA` original permanece **intacta**.

4. **Adicionar o botão no JSX** logo após o botão atual "Gerar PDF Resumo" sem IA (~linha 3422). Mesma variante/tamanho/ícone do vizinho, `disabled={gerandoResumoSemRepeticao || ...}`, label "Resumo PDF sem repetição" (mobile: "Sem repetição"), `title`: "Mesmo Resumo sem IA, descartando publicações idênticas para o mesmo processo (varia só o intimado)".

## O que NÃO muda

- `handleGerarPdfResumoSemIA` e seu botão permanecem 100% iguais.
- Layout/regras de PDF, ordem das publicações, comentários, contadores.
- Demais botões (IA desabilitados, "Resumo Rápido", "DOC Resumo") intactos.
- Sem migration, sem edge function, sem alteração de banco.

## Validação

- Build (`bun run build`) deve passar.
- Verificação manual na preview: período com publicações repetidas por intimado → novo botão gera PDF com um único bloco por processo quando o conteúdo é idêntico fora do "Destinatário(s):". Conferir lado a lado com o "Gerar PDF Resumo" original para garantir que o original ainda lista todas as repetições.

## Trade-off considerado

Duplicar ~190 linhas de código aumenta a manutenção (uma futura mudança no layout do PDF "sem IA" precisará ser replicada nas duas funções). O usuário priorizou isolamento total sobre DRY, então seguimos por cópia.
