

## Plano: Adicionar aba "Bradesco" na página Importar Processos

### Objetivo
Criar uma nova aba "Bradesco" na página de importação de processos (`/importar`) seguindo o mesmo padrão das abas existentes (Dr. Osmar, Dra. Janaina, etc.), com seletores de coordenação, cliente e responsável, download de planilha modelo, e parsing/importação da planilha.

### Colunas da planilha Bradesco
| Coluna | Campo no banco |
|---|---|
| GCPJ | `identificador_projuris` |
| RECLAMANTE | `polo_ativo` |
| PROCESSO | `numero` (CNJ) |
| ORGAO_JULGADOR | `vara` |
| TRAMITAÇÃO (Vara/TRT/TST) | `tribunal` |
| FASE PROCESSUAL | `fase` + mapeamento para `status` |
| ANDAMENTO | `andamento_atual` |

### Mapeamento de status
- Encerrado → `encerrado`
- Suspenso → `suspenso`
- Demais (Execução, Recursal, Inicial, Liquidação, Conhecimento) → `ativo`

### Campos fixos
- `area` = "trabalhista"
- `justica` = "Trabalho"
- `polo_passivo` = preenchido com "BANCO BRADESCO S.A." por padrão

### Alterações

#### 1. `src/utils/generateTemplates.ts`
- Adicionar template `bradesco` com as 7 colunas: GCPJ, RECLAMANTE, PROCESSO, ORGAO_JULGADOR, TRAMITAÇÃO, FASE PROCESSUAL, ANDAMENTO
- Adicionar função `downloadBradescoTemplate()`

#### 2. `src/pages/ImportarProcessos.tsx`
- Adicionar nova aba "Bradesco" no `TabsList` (grid passará de 10 para 11 colunas)
- Adicionar estados: `bradescoFile`, `bradescoProcessos`, `bradescoImporting`, `bradescoProgress`, etc.
- Implementar `parseBradescoExcel()` seguindo o padrão do `parseOsmarExcel`:
  - Mapear colunas GCPJ, RECLAMANTE, PROCESSO, ORGAO_JULGADOR, TRAMITAÇÃO, FASE PROCESSUAL, ANDAMENTO
  - Validar número do processo (mínimo 5 caracteres)
  - Mapear FASE PROCESSUAL para status
- Implementar `handleBradescoImport()` seguindo o padrão existente:
  - Verificar duplicatas por número
  - Upsert com coordenação, cliente e responsável selecionados
  - Opção de buscar andamentos
- Adicionar `TabsContent value="bradesco"` com:
  - Botão download modelo
  - Upload de arquivo
  - Seletor de coordenação
  - Seletor de advogado responsável
  - Seletor de cliente
  - Switch buscar andamentos
  - Tabela de pré-visualização
  - Botões importar/limpar/cancelar

### Escopo
- 2 arquivos modificados
- Sem migração de banco necessária
- Segue 100% o padrão das abas existentes

