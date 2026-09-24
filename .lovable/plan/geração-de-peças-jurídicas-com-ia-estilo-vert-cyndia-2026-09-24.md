# Geração de Peças Jurídicas com IA (estilo Vert/CyndIA)

## Resumo

Criar um sistema de geração de minutas de peças jurídicas (contestações, recursos, contrarrazões) baseado em um **banco de teses** curado pelo time jurídico, com **busca por similaridade (RAG)** sobre esse banco e **IA generativa** para redigir a peça a partir da tese encontrada + dados do processo. Toda peça gerada passa por **revisão humana** antes do uso.

## Como a Vert/CyndIA faz

A CyndIA usa três camadas: IA generativa + RAG + curadoria. O time jurídico mantém um banco de teses validado; a IA consulta esse banco por similaridade, contextualiza o caso e gera a minuta. Toda peça passa por revisão humana. Cada decisão é registrada e auditável.

## O que já temos

- IA: edge functions com Gemini (`gemini-openai-compat.ts`) e logger de custo (`ai-usage-logger.ts`)
- Dados do processo: `processos` (classe, assunto, tribunal, vara, valor, resultado), `processos_partes` (polo, nome, advogado), `movimentacoes` (datas, conteúdo), `documentos_texto_indexado` (texto do PDF da inicial)
- Prompts compartilhados: `prompts_ia_tst` e `prompts_ia_publicacoes` (por coordenação)
- Modelos de título: `modelos_titulo_coordenacao` (padrões de tarefas/prazos)
- Inteligência Jurídica: RPCs `get_inteligencia_*` já processam histórico de êxito por turma/relator/matéria

## O que falta

### Fase 1 — Banco de Teses (cadastro)

Nova tabela `teses_juridicas`:
- `id`, `coordenacao_id` (FK), `titulo`, `tipo_peca` (contestação, recurso_ordinário, contrarrazoes, peticao_inicial, memoriais)
- `area` (trabalhista, civil, empresarial), `materia` (texto), `assunto_cnj` (texto)
- `fundamentos` (text — a tese em si: argumentos, jurisprudência, fundamentos)
- `tipo_recurso` (text — quando aplicável: ED, RO, etc.)
- `tags` (text[] — palavras-chave para busca)
- `ativo` (bool), `criado_por` (FK auth.users), `created_at`, `updated_at`
- RLS: todos leem; admin/coordenador da coordenação editam
- Trigger de `updated_at`

Tela **Banco de Teses** (menu Configurações, admin/coordenador):
- Lista por coordenação, tipo de peça, área
- CRUD inline (igual às outras telas do sistema)
- Editor com texto rico (fundamentos jurídicos)
- Campo de tags livre

### Fase 2 — Busca por similaridade (RAG)

Edge Function `buscar-teses` (ou RPC no banco):
- Entrada: `processo_id`, `tipo_peca`
- Busca dados do processo (classe, assunto, tipo de recurso, partes, matérias)
- Busca no `documentos_texto_indexado` o texto da petição inicial (se houver)
- Matching contra `teses_juridicas`: filtra por `tipo_peca`, `area`, `coordenacao_id`; pontua por `assunto_cnj`, `materia`, `tags`, `tipo_recurso`
- Retorna as top 3-5 teses mais aplicáveis com score de relevância
- Sem embeddings externas — busca textual + metadados (assunto, matéria, tags) para manter simplicidade e custo baixo; pode evoluir para embeddings depois

### Fase 3 — Gerador de Minutas

Edge Function `gerar-peca-juridica`:
- Entrada: `processo_id`, `tipo_peca`, `tese_id` (opcional — se ausente, usa a melhor da busca), `observacoes` (opcional)
- Coleta: dados do processo, partes (polos), movimentações recentes, texto indexado da inicial, tese selecionada
- Prompt do sistema: instrução para gerar a peça no formato processual correto (art. 319 CPC / art. 840 CLT), citando a tese aplicável
- Modelo: Gemini (flash-latest) via `geminiChatCompletionsFetch`, com fallback para OpenAI se configurado
- Retorna: texto da minuta + tese usada + score + metadados
- Loga em `ai_usage_logs` (custo, tokens, modelo, usuário)
- Salva a minuta gerada em nova tabela `pecas_geradas` (id, processo_id, tipo_peca, tese_id, conteudo, modelo_ia, criado_por, revisado, created_at)

### Fase 4 — Tela de Geração e Revisão

Nova aba ou botão na ficha do processo (Processos e Casos / Distribuição TST):
- Botão **"Gerar Peça"** → escolher tipo → opcionalmente selecionar tese do banco → gerar
- Preview da minuta em texto formatado
- Editável inline antes de usar
- Marcar como **revisada** (governança — só peças revisadas podem ser exportadas/copiadas)
- Baixar como .docx (igual aos exports existentes)
- Histórico de peças geradas para o processo

### Fase 5 — Governança e Auditoria

- Toda geração registra: usuário, data, processo, tese usada, modelo, custo
- Peças não-revisadas têm selo "Rascunho" — não podem ser exportadas
- Só admin/coordenador pode ativar/desativar teses no banco
- Isolamento por coordenação mantido (RLS em `teses_juridicas` e `pecas_geradas`)

## Detalhes técnicos

- **Tabelas novas**: `teses_juridicas`, `pecas_geradas` — ambas com GRANT + RLS + isolamento por coordenação
- **Edge functions**: `buscar-teses` (read-only) e `gerar-peca-juridica` (write, loga em ai_usage_logs)
- **IA**: Gemini flash-latest (já usado no projeto) com `geminiChatCompletionsFetch`; custo já rastreado por `ai-usage-logger.ts`
- **Sem embeddings externas** na Fase 1-2: busca por metadados + ILIKE em tags/fundamentos. Evolução para pgvector opcional depois.
- **Sem Lovable Gateway**: seguir o padrão do projeto (Gemini/OpenAI direto)
- **Tela**: React + MainLayout (igual às outras), menu em Configurações para o banco de teses, botão na ficha do processo para gerar
- **Export .docx**: reusar `docx` ou JSZip como nos exports existentes

## Entrega incremental

1. **Fase 1+2**: banco de teses + busca → já útil sozinho (consulta manual)
2. **Fase 3+4**: geração + tela → fluxo completo de gerar peça
3. **Fase 5**: auditoria → selo de revisão, histórico

Cada fase funciona sozinha. A Fase 1 é o pré-requisito de todas as outras.
