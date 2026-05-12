## Problema

No fluxo "Gerar PDF Resumo" e "Gerar Doc Resumo" (Análise DJEN), algumas publicações chegam ao arquivo final sem o bloco "Conteúdo Integral" (apenas cabeçalho/partes/advogados — o usuário enxerga isso como "publicação cortada"), e as **pautas de julgamento** ficam reduzidas a praticamente uma linha (ex.: `Resumo: Pauta de julgamento.\nProcesso em pauta: …` ou `Resumo: Aditamento à Pauta de Julgamento … (sessão virtual)..\nProcesso em pauta: …`).

Causas identificadas em `src/pages/AnaliseDjen.tsx` (handlers `handleGerarPdfResumo` e `handleGerarDocResumo`) e na edge function `supabase/functions/resumir-publicacoes/index.ts`:

1. **Pautas** — `resumirTrechoPauta()` (linhas ~1174‑1206) tenta achar campos rótulados ("Data e hora de início da sessão Virtual", "Relator", "AGRAVANTE", etc.). Quando a pauta vem em outro formato (ex.: "Aditamento à Pauta de Julgamento" do TST, pautas sem esses rótulos exatos), nenhum dos campos é encontrado e a saída fica reduzida a `Resumo: <título>.` + `Processo em pauta: …`. O bloco do processo (que tem relator, partes, advogados, intimados em texto livre) é descartado.
2. **Publicações "cortadas"** — no `for` que chama `resumir-publicacoes`, qualquer falha (rate‑limit/timeout/JSON inválido vindo do modelo) cai no `catch`, incrementa `erros` e a publicação **não entra** em `resumosMap`. Na renderização (`if (resumoIA) { … }`) o bloco "Conteúdo Integral" é simplesmente omitido — a publicação aparece sem corpo. Não há fallback determinístico.

Os botões "Resumo Rápido" (PDF e DOC) **não serão alterados**.

## Mudanças

### 1. `src/pages/AnaliseDjen.tsx`

- **Pautas — preservar o bloco do processo**:
  - Reescrever `resumirTrechoPauta` para que, quando os campos rotulados não forem encontrados, devolva o cabeçalho da sessão + o bloco do processo extraído por `extractTrechoPauta` na íntegra (com quebras de linha), em vez de uma única frase. Garantir mínimo: título da pauta, data/sessão (se houver), processo, e o texto literal do bloco do processo (relator, partes, advogados, intimados em texto livre).
  - Quando os rótulos forem encontrados (caso atual TRT15), continuar emitindo o resumo estruturado, mas **acrescentar abaixo** o bloco do processo original como "Detalhes da pauta" para não perder informação.

- **Fallback para falhas da IA** (`handleGerarPdfResumo` e `handleGerarDocResumo`):
  - Quando `aiError` é lançado ou `aiData?.resumo` vier vazio, não apenas incrementar `erros`: também salvar em `resumosMap` um resumo determinístico local construído a partir do conteúdo da publicação (reaproveitar `extractTrechoFinal` já presente no arquivo, ou um texto curto como "Resumo automático indisponível — trecho final da publicação:" + trecho extraído). Isso garante que a publicação **sempre** apareça com algum conteúdo.
  - Aumentar levemente o backoff em caso de 429/timeout (ex.: tentar uma 2ª chamada após 1500 ms antes de desistir) para reduzir falhas transitórias.

### 2. `supabase/functions/resumir-publicacoes/index.ts`

- Em `resumirPautaDeterministico` (espelho server‑side da função da página), aplicar o mesmo princípio: se nenhum dos campos rotulados foi capturado, devolver o `extrairTrechoPauta(...)` (cabeçalho + bloco do processo) na íntegra em vez de só `título + processo`.
- No modo `resumoIndividual`, quando ambas as fases falharem, retornar um `resumo` baseado em `extrairTrechoFinal(conteudo)` (já implementado no arquivo) com prefixo "Conteúdo extraído automaticamente:". Hoje a função devolve `'Erro ao gerar resumo desta publicação.'`, o que combinado ao `catch` do front‑end faz a publicação sumir do PDF.

## Detalhes técnicos

- Não tocar em `handleGerarPdfResumoRapido` nem `handleGerarDocResumoRapido` (linhas 2034‑2289).
- Reusar funções já existentes no próprio arquivo (`extractTrechoPauta`, `extractTrechoFinal`) — nenhum prompt da IA precisa mudar.
- Manter a chamada à edge function inalterada na assinatura; só ampliar a lógica de extração e fallback.
- O `resumosMap` passa a ter sempre uma entrada por publicação, garantindo que o loop de renderização (`if (resumoIA)`) sempre emita "Conteúdo Integral".

## Validação

- Regerar o PDF Resumo a partir da mesma data; conferir que (a) processos em pauta passam a exibir relator/partes/advogados/intimados além do número, e (b) nenhuma publicação aparece sem o bloco "Conteúdo Integral".
- Conferir o mesmo no DOCX gerado por "Gerar Doc Resumo".
- Resumo Rápido (PDF e DOC) deve permanecer idêntico ao atual.