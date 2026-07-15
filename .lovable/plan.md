## Testemunhas do Processo

Adicionar cadastro de testemunhas (múltiplas por processo) na tela de detalhes do processo, com indicação de qual parte arrolou, e filtros na listagem de processos.

### 1. Banco de dados

Nova tabela `processos_testemunhas`:
- `processo_id` (FK → processos)
- `nome` (obrigatório)
- `cpf_rg` (opcional)
- `telefone` (opcional)
- `email` (opcional)
- `arrolada_por` (opcional — texto livre ou referência a `processos_partes.id` via UUID nullable)
- `observacoes` (texto)
- padrões: id, created_at, updated_at, created_by

RLS: seguir padrão de `processos_partes` (acesso por coordenação/responsáveis do processo). GRANTs para `authenticated` e `service_role`.

### 2. Tela de detalhes do processo

Novo card **"Testemunhas"** na aba de partes/detalhes do processo:
- Lista de testemunhas com nome, contato, "arrolada por" (dropdown com as partes existentes do processo) e observações
- Edição inline (padrão do projeto — sem botão "Editar")
- Botão "+ Adicionar testemunha"
- Ação de remover em cada linha

### 3. Filtros em Processos

Em `useProcessosPaginados` + UI de filtros da tela de Processos:
- **Busca por nome de testemunha** (campo texto)
- **Checkbox "Com testemunhas cadastradas"**

Ajustar a RPC `get_processos_paginados` para aceitar os dois novos parâmetros (`_testemunha_nome`, `_com_testemunha`) e filtrar via EXISTS em `processos_testemunhas`.

### Detalhes técnicos

- Migração cria tabela + índices em `processo_id` e `nome` (para busca ILIKE)
- Hook `useProcessoTestemunhas(processoId)` com invalidação assíncrona antes de fechar/atualizar UI
- Validação com zod: nome obrigatório (max 200), cpf_rg (max 20), telefone (max 30), email válido, observações (max 1000)
- Sem alterações em edge functions

### Fora do escopo

- Intimação/notificação de testemunhas
- Vinculação a audiências (pode ser feito depois se solicitado)
