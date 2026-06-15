## O que será construído

### 1. Novo menu "Prompt IA TST"
CRUD de prompts compartilhados **por coordenação** (mesmo padrão de isolamento já usado no projeto).

Cadastro do prompt:
- **Título** (aparece na lista da aba "Analisar com IA")
- **Texto do prompt** (instruções para a IA)
- **Descrição/observações** (quando usar)
- **Modelo Gemini** (select: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`) — default `gemini-2.5-flash`
- **Ativo/Inativo** (toggle; inativos somem da lista de seleção)
- **Auditoria**: data de cadastro, criado por, data de alteração, alterado por (preenchido automaticamente)

Edição inline (sem botão "Editar"), padrão do projeto.

### 2. Aba "Analisar com IA" na tela Distribuição TST
Ao clicar num processo da lista, abre o painel/modal de detalhes já existente e adiciona-se a aba **Analisar com IA** com este fluxo:

1. **Select de Prompt** — lista os prompts ativos da coordenação (mostra Título).
2. **Botão "Buscar anexos (Judit)"** — chama a Judit com `response_type: attachments` para o número do processo; mostra spinner.
3. **Lista de anexos com checkbox** — cada item exibe nome do arquivo, tipo (PDF/DOC), data e tamanho. Advogado marca os que quer usar.
4. **Botão "Analisar com IA"** — envia para a edge function `analisar-tst-ia` com: `prompt_id`, `processo_id`, lista de anexos selecionados (URLs/IDs Judit).
5. **Painel de Sugestões** — ao lado de cada campo do formulário de Distribuição TST, a sugestão da IA aparece com botões **Aceitar** / **Ignorar**. Aceitar copia o valor para o campo (sem sobrescrever nada automaticamente).

### 3. Backend
- Tabela `prompts_ia_tst` com isolamento por `coordenacao_id` (RLS).
- Edge function `analisar-tst-ia`:
  - Baixa os anexos selecionados via Judit (proxy/download já existente no projeto).
  - Envia para Gemini (`generativelanguage.googleapis.com`) como multimodal (PDFs inline) + prompt do advogado + instrução fixa para retornar JSON estruturado com os campos do formulário TST.
  - Retorna `{ campo: { sugestao, confianca } }` para o frontend popular o painel.

### Detalhes técnicos

**DB (migration nova):**
```sql
CREATE TABLE public.prompts_ia_tst (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  prompt text NOT NULL,
  descricao text,
  modelo text NOT NULL DEFAULT 'gemini-2.5-flash',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompts_ia_tst TO authenticated;
GRANT ALL ON public.prompts_ia_tst TO service_role;
ALTER TABLE public.prompts_ia_tst ENABLE ROW LEVEL SECURITY;
-- Policies: membros da coordenacao podem CRUD; trigger seta updated_at/updated_by.
```

**Frontend:**
- Novo item no sidebar: "Prompt IA TST" → rota `/prompts-ia-tst` com lista + edição inline.
- Hook `usePromptsIaTst(coordenacaoId)` com React Query e `await invalidateQueries` antes de fechar/atualizar UI (padrão do projeto).
- Nova aba dentro do componente de detalhes do processo em Distribuição TST: `AnalisarComIATab.tsx`.

**Edge function `analisar-tst-ia`:**
- `verify_jwt = true`.
- Lê `GEMINI_API_KEY` e `JUDIT_API_KEY` via `Deno.env`.
- Para cada anexo selecionado: baixa PDF da Judit → base64 → envia como `inline_data` pro Gemini.
- Prompt do sistema instrui a IA a devolver JSON com chaves = nomes dos campos do formulário TST. O texto do prompt cadastrado pelo advogado entra como contexto adicional.
- Resposta normalizada `{ sugestoes: { campo: valor } }`.

**Saída no formulário:** painel colapsável ao lado direito do form com cada sugestão e botão "Aceitar" (preenche o campo correspondente sem salvar — o advogado revisa e salva manualmente).

### Confirmação antes de codar
- Já existe um componente "detalhes do processo" em Distribuição TST onde abrirei a nova aba (vou localizar pelo caminho da tela). Se preferir que abra em modal separado em vez de aba, me avise.
- Vou usar `gemini-2.5-flash` como default. Posso adicionar `gemini-2.5-pro` na lista. Confirma essa lista de modelos?
