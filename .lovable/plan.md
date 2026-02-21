

## Implementar envio individual + resumo fluído sem marcadores

### 1. Edge function (`supabase/functions/resumir-publicacoes/index.ts`)

**Alterar o prompt** para gerar texto corrido e fluído, sem marcadores markdown:
- Remover instruções de "estruture com tópicos usando marcadores"
- Adicionar instrução explícita: "Escreva em texto corrido, parágrafos curtos. NÃO use markdown (###, **, ---, bullets). NÃO inicie com frases como 'Aqui está a análise...' ou 'Segue o resumo...'. Vá direto ao conteúdo."
- Manter a exigência de capturar Acórdão, Ementa, Decisão, Prazos, Certidões quando presentes

**Simplificar modo `resumoIndividual`**:
- Aceitar campo `publicacao` (objeto único) além do array `publicacoes`
- Quando receber objeto único: chamar a IA uma vez e retornar `{ id, resumo }`
- Remover lógica de batching (lotes de 5)

### 2. Frontend (`src/pages/AnaliseDjen.tsx`)

**Alterar `handleGerarPdfResumo`**:
- Iterar publicações uma a uma no frontend
- Para cada publicação, chamar `supabase.functions.invoke('resumir-publicacoes', { body: { resumoIndividual: true, publicacao: { id, conteudo, processo, data } } })`
- Atualizar toast de progresso: "Resumindo 3/15..."
- Se falhar uma, registrar erro e continuar
- Montar `resumosMap` progressivamente
- Após todas finalizadas, gerar o PDF

**No PDF**: imprimir o resumo como texto simples (cor preta, sem prefixo "Resumo (IA):"), apenas o conteúdo retornado pela IA diretamente abaixo dos metadados da publicação.

### Resultado esperado
Cada publicação no PDF terá: cabeçalho com número do processo, metadados (órgão, data, partes, advogados) e logo abaixo um texto corrido fluído com o resumo jurídico, sem formatação markdown e sem frases introdutórias.

