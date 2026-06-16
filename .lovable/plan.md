
## Problema confirmado

`preencher-form-ia-anexos` hoje limita o prompt a `maxChars = 90.000` e dá `break` no overflow — quando estoura, descarta todos os documentos restantes (não só corta a página). Em processos reais temos 200k a 9M caracteres indexados (até 73 documentos), então a IA frequentemente **nunca vê** acórdão/RR/certidão que estão no fim da lista. Limite de `.limit(800)` páginas também impede leituras de processos muito grandes.

## Solução: priorização + múltiplas chamadas com merge

### 1. Priorizar documentos substantivos antes de cortar
Em `index.ts`, antes de montar o `fullText`, reordenar os documentos colocando primeiro os que têm regex substantiva (acórdão, recurso de revista, RR, AIRR, sentença, decisão monocrática, embargos, contestação, certidão de baixa, intimação de pauta) — mesma regex já usada em `analise-quarteirizado-ia/index.ts`. O resto vai depois.

### 2. Aumentar o orçamento por chamada
Subir `maxChars` para `~600.000` (≈ 150k tokens; folga confortável dentro de 1M do Gemini 2.5 Pro) e `.limit(800)` → `.limit(5000)` páginas. Já cobre ~95% dos processos numa única chamada.

### 3. Map-reduce para processos que ainda estouram
Se após priorização o conteúdo total ainda exceder `maxChars`:
- Dividir os documentos em N chunks de até `maxChars` cada (sem quebrar um documento entre chunks; se um único documento for maior que o limite, ele vira seu próprio chunk truncado, mas isso será raro).
- Disparar as N chamadas ao Gemini **em paralelo** (`Promise.all`) com o mesmo system prompt e os mesmos dados Judit.
- Fazer merge das respostas:
  - Campos escalares (datas, tipo_julgamento, transito_julgado, etc.): aplicar prioridade por confiança `alta > media > baixa`; em empate, primeira ocorrência vence; registrar conflitos em `_alertas` ("data_julgamento divergente entre chunks: X vs Y").
  - Campos de lista textual concatenada (`materias_recurso_*`): unir e deduplicar termos.
  - `_evidencias`: mesclar mantendo o trecho da chamada que venceu o campo.
  - `_alertas`, `_campos_pendentes_revisao_humana`: concatenar e deduplicar.
- Passar o resultado merged para `validarEHidratar` (validar.ts) exatamente como hoje — o pipeline de validação/hidratação Judit não muda.

### 4. Telemetria
Retornar no JSON final: `docs_analisados`, `paginas_analisadas`, `chunks_executados`, `chars_enviados`, para o frontend exibir se quiser.

## Aplicar a mesma estratégia em `analise-quarteirizado-ia`?
Atualmente também tem `maxChars = 90.000` + `break`. O escopo dele já é mais estreito (só peças substantivas), mas para acórdãos grandes pode truncar. **Pergunta para você:** quer que eu aplique map-reduce também nessa função, ou deixo só na `preencher-form-ia-anexos` por enquanto?

## Arquivos a alterar
- `supabase/functions/preencher-form-ia-anexos/index.ts` — priorização, novo `maxChars`, loop de chunks, merge, telemetria.
- (Opcional) `supabase/functions/analise-quarteirizado-ia/index.ts` — mesmo tratamento.

Nenhuma mudança de schema, frontend, ou validar.ts.
