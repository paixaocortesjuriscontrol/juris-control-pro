# Prompt IA por coordenação e tipo

Hoje o botão **Preencher com IA** (usado em Prazo, Tarefa, Evento e Audiência criados a partir de publicações) chama a edge function `analisar-publicacao-ia` com um `systemPrompt` fixo no código. A proposta é permitir que cada **coordenação** cadastre seu próprio prompt para cada **tipo** de item, mantendo o prompt atual como padrão quando não houver personalização.

Observação: já existe a página `Prompt IA TST` (para Distribuição TST via Gemini com anexos). Essa página é de outro fluxo e continua intocada. Criaremos um módulo separado — **Prompt IA (Publicações)** — porque o escopo, os campos e o consumo são diferentes.

## O que muda

1. **Nova tabela** `prompts_ia_publicacoes` no Supabase.
   Colunas: `id`, `coordenacao_id` (FK), `tipo_item` (`prazo` | `tarefa` | `evento` | `audiencia`), `prompt` (texto), `ativo` (bool), `created_at`, `updated_at`, `created_by`.
   Constraint única `(coordenacao_id, tipo_item)` — cada coordenação tem no máximo um prompt por tipo.
   RLS: leitura para autenticados da coordenação; escrita apenas para admin/coordenador da coordenação.
   GRANTs para `authenticated` e `service_role` conforme padrão do projeto.

2. **Nova página** `/prompt-ia-publicacoes` (arquivo `src/pages/PromptIaPublicacoes.tsx`) com entrada no menu **Administração** → card **Prompt IA (Publicações)**.
   - Layout parecido com `PromptIaTst.tsx`, mas simplificado.
   - Filtro por Coordenação (admin vê todas; coordenador vê a sua).
   - Uma linha por combinação Coordenação × Tipo, mostrando: título fixo do tipo, textarea do prompt, botão **Restaurar padrão** (que preenche com o prompt hoje hardcoded), switch Ativo, botão Salvar (edição inline, sem "Editar").
   - Quando não houver registro, mostra o prompt padrão em modo leitura + botão **Personalizar**.

3. **Constantes de prompt padrão** em `src/constants/promptsIaPublicacoes.ts`, exportando `PROMPT_PADRAO_POR_TIPO` (prazo/tarefa/evento/audiência). O prompt de "prazo" reproduz o `systemPrompt` atual da edge function; os demais são variações adaptadas (foco em data/hora e local para evento/audiência, foco em ação para tarefa).
   Esse mesmo arquivo é usado pelo frontend (botão "Restaurar padrão") e pela edge function (fallback).

4. **Edge function `analisar-publicacao-ia`** passa a:
   - Receber `tipoItem` (`prazo` | `tarefa` | `evento` | `audiencia`) e `coordenacaoId` do cliente.
   - Buscar em `prompts_ia_publicacoes` o prompt ativo para `(coordenacao_id, tipo_item)`.
   - Se existir e estiver `ativo`, usa esse prompt como `systemPrompt`; senão, usa o padrão do tipo (constantes espelhadas no edge, para não depender de import cross-runtime).
   - Restante do fluxo (tool call, cálculo de vencimento, data fatal) mantido.

5. **`BotaoPreencherIA`** recebe duas novas props: `tipoItem` e `coordenacaoId`. Todos os call sites (`PrazoDialog`, `NovaTarefaDialog`, `EventoDialog`, `NovaAudienciaPublicacaoDialog`, `TarefaPublicacaoView`) passam o `tipoItem` correspondente e a coordenação do processo/tarefa em contexto.

## Comportamento

- Sem cadastro → funciona exatamente como hoje (prompt padrão do tipo).
- Coordenação cadastrou prompt para "prazo" mas não para "evento" → prazo usa customizado, evento usa padrão.
- Prompt inativo é tratado como inexistente (usa padrão).
- Somente **admin** e **coordenador da coordenação** podem editar; demais usuários só visualizam.

## Detalhes técnicos

- Migration em `supabase/migrations/`:
  ```sql
  CREATE TYPE tipo_item_prompt_ia AS ENUM ('prazo','tarefa','evento','audiencia');
  CREATE TABLE public.prompts_ia_publicacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
    tipo_item tipo_item_prompt_ia NOT NULL,
    prompt text NOT NULL,
    ativo boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (coordenacao_id, tipo_item)
  );
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompts_ia_publicacoes TO authenticated;
  GRANT ALL ON public.prompts_ia_publicacoes TO service_role;
  ALTER TABLE public.prompts_ia_publicacoes ENABLE ROW LEVEL SECURITY;
  -- policies: SELECT para membros da coordenação; INSERT/UPDATE/DELETE via has_role('admin') OU coordenador
  ```
- Hook `usePromptsIaPublicacoes` (list/create/update/delete) seguindo o padrão de `usePromptsIaTst`.
- Cache invalidation via `await queryClient.invalidateQueries(...)` antes de mostrar toast (padrão do projeto).
- Provedor de IA mantido (Gemini via `gemini-openai-compat.ts`) — sem AI Gateway.

## Fora do escopo

- Não alteramos `PromptIaTst` (Distribuição TST) — é outro fluxo.
- Não migramos prompts existentes retroativos: quem já usava o padrão continua no padrão até personalizar.
