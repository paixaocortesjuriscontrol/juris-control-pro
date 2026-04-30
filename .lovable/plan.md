## Objetivo

Corrigir o efeito introduzido pela **classificação antes da gravação** sem mexer na busca paralela, no pool de VPS ou no fluxo geral que já funcionava antes.

## O que foi confirmado

- A busca está retornando muitos resultados.
- O problema aparece **depois** da etapa nova de classificação/formatação pré-gravação.
- O trigger `mark_djen_duplicada_on_insert()` deduz duplicidade usando:
  - `coordenacao_id`
  - `dedup_processo_digits`
  - `dedup_data_ref`
  - `dedup_head_norm`
- `dedup_head_norm` hoje é derivado do `conteudo` já formatado/classificado.
- Como a publicação pode ser capturada por mais de um monitoramento/termo da mesma coordenação no mesmo dia, a regra atual está colapsando registros que antes apareciam corretamente.

## Hipótese principal

A chave de duplicação por coordenação/dia ficou **ampla demais** depois da classificação pré-gravação. Em vez de preservar o vínculo por monitoramento/termo, ela passou a tratar capturas diferentes como a mesma publicação.

## Implementação proposta

### 1. Corrigir a regra de duplicidade no banco

Ajustar a função `public.mark_djen_duplicada_on_insert()` para que a comparação respeite o contexto correto da captura por termo.

A correção seguirá uma destas abordagens, priorizando a mais conservadora:

- **Opção preferida:** incluir `monitoramento_id` na lógica de deduplicação de `publicacoes_djen`
- **Fallback conservador:** usar uma chave derivada do conteúdo original que não seja contaminada pelo cabeçalho/classificação adicionados antes do insert

A prioridade é restaurar o comportamento que existia antes da classificação pré-gravação, com o menor impacto possível.

### 2. Alinhar o pré-check do frontend com a mesma regra

No arquivo `src/hooks/useDjenTermosParalelaEngine.ts`:

- ajustar o pré-check de `chavesEncontradas`
- fazer o filtro local usar exatamente a mesma lógica do banco
- evitar que o frontend conte como “nova” uma publicação que o trigger ainda vai reclassificar

### 3. Corrigir a contagem mostrada na execução

Mesmo quando houver reclassificação legítima para `duplicada`, o contador exibido precisa refletir o resultado final real do banco.

Assim, o usuário não verá mais casos como:
- engine: 114 encontradas
- tela: 15 visíveis

## Arquivos / áreas afetadas

- `supabase/migrations/...` — ajuste da função `mark_djen_duplicada_on_insert()`
- `src/hooks/useDjenTermosParalelaEngine.ts` — alinhamento do pré-check e da contagem

## Resultado esperado

Após o ajuste:

- a consulta volta a se comportar como antes da classificação pré-gravação
- publicações não serão descartadas indevidamente por uma chave errada
- a contagem da execução e a contagem exibida na Análise DJEN voltarão a bater

## Observação

Vou fazer isso de forma cirúrgica, sem redesenhar a engine paralela e sem mexer no pool Browser/VPS.