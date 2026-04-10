

## Plano: Substituir a lógica de verificação de trânsito em julgado pela versão robusta

### Resumo

Substituir a edge function monolítica `verificar-transito-julgado` pela nova arquitetura modular com 4 arquivos (`types.ts`, `datajud-client.ts`, `transito-detector.ts`, `index.ts`), criando uma nova edge function `check-transito`. O frontend será atualizado para usar a nova função e interpretar os novos campos de resposta (status com 4 valores, confiança numérica, fase executória).

### Problema com a abordagem atual

A função atual usa detecção binária (encontrou/não encontrou trânsito) e uma lista frágil de exclusões. A nova lógica traz:
- Confiança numérica (95/75/50) em vez de binário
- Detecção de negação contextual (evita falsos-positivos como "certidão negativa de trânsito")
- Categoria `transitado_execucao` separada (penhora, leilão, precatório)
- Movimentações desconhecidas tratadas conservadoramente como recurso
- Reconciliação TST+TRT com 4 regras explícitas

### Mudanças necessárias

**1. Criar nova edge function `check-transito` (4 arquivos)**

Copiar os 4 arquivos enviados para `supabase/functions/check-transito/`:
- `types.ts` — tipos TypeScript
- `datajud-client.ts` — cliente DataJud com ordenação temporal garantida
- `transito-detector.ts` — detecção em 3 níveis + classificação pós-trânsito
- `index.ts` — handler HTTP com reconciliação TST+TRT

Ajustes necessários:
- A API key do DataJud está hardcoded na função atual. Na nova, usa `Deno.env.get("DATAJUD_API_KEY")`. Será necessário adicionar o secret ou manter hardcoded.
- A nova função processa **um processo por vez** (POST com `{ numeroProcesso }`), diferente da atual que recebe array. O batching ficará 100% no frontend.
- A nova função **não faz update no banco** (`dados_benner`). O frontend fará o update após receber a resposta.
- Manter a autenticação via header Authorization

**2. Atualizar o frontend (`src/pages/DadosBenner.tsx`)**

- Chamar `check-transito` em vez de `verificar-transito-julgado`
- Enviar um processo por chamada (com paralelismo controlado de 2-3)
- Mapear os novos status para os existentes na UI:
  - `transitado` → "Trânsito em Julgado"
  - `transitado_execucao` → "Trânsito em Julgado (Execução)"
  - `ativo` → "Ativo"
  - `inconclusivo` → "Inconclusivo"
- Exibir o campo `confianca` na interface (badge ou tooltip)
- Fazer o update em `dados_benner.situacao_processo` após cada resposta

**3. Adicionar secret `DATAJUD_API_KEY`**

Configurar a chave da API DataJud como secret da edge function (valor já existente no código atual).

**4. Manter a função antiga**

A função `verificar-transito-julgado` será mantida temporariamente para não quebrar nada. Pode ser removida depois.

### Detalhes técnicos

- A nova função usa `serve()` do Deno std ao invés de `Deno.serve()` — ambos funcionam no Supabase Edge Functions
- A nova função usa `term` query (match exato) em vez de `match` query — mais preciso no Elasticsearch
- A nova função pede `size: 1` (vs `size: 10`) — suficiente pois o número CNJ é único por tribunal
- O frontend fará o batching com `Promise.allSettled` para 2 chamadas paralelas por vez

