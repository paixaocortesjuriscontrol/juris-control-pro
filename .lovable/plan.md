

## Plano: TST Prazos — Kanban + Formulário + Link Processo

### Resumo
Criar página "TST Prazos" com:
1. Kanban de 5 colunas (automático por dias até prazo fatal)
2. Filtro por coordenação
3. Formulário para cadastrar novo prazo (mesmos campos da planilha)
4. Importação de planilha XLSX
5. Link para detalhes do processo quando existir no Supabase
6. Modal de detalhes ao clicar no card

---

### 1. Migração SQL — tabela `prazos_tst`

Campos: `id` uuid PK, `coordenacao_id` uuid FK, `numero_processo` text, `dossie` text, `reu` text, `autor` text, `equipe` text, `decisao` text, `formulario` text, `providencias` text, `deposito_judicial` text, `preparo` text, `multa_custas` text, `responsavel` text, `data_fatal` date NOT NULL, `status` text default 'pendente', `processo_id` uuid FK processos (nullable — para vincular ao processo no sistema), `created_at`, `updated_at`.

RLS: SELECT/INSERT/UPDATE/DELETE para authenticated.

Trigger `update_updated_at_column`.

### 2. Sidebar + Rota

- Adicionar `{ icon: Clock, label: "TST Prazos", path: "/tst-prazos" }` no `menuItemsPublicos`
- Registrar rota `/tst-prazos` no App.tsx com ProtectedRoute

### 3. Página `src/pages/TstPrazos.tsx`

- Filtro por coordenação no topo (padrão: coordenação do usuário)
- Botão "Importar Planilha" e botão "Novo Prazo"
- Renderiza `TstKanbanBoard`

### 4. Componentes

| Arquivo | Função |
|---|---|
| `src/pages/TstPrazos.tsx` | Página com filtro coordenação, botões de ação |
| `src/components/tst-prazos/TstKanbanBoard.tsx` | Board com 5 colunas calculadas por dias até data_fatal |
| `src/components/tst-prazos/TstPrazoCard.tsx` | Card com nº processo, autor, responsável, badge dias. **Botão/link para `/processos/:id`** quando `processo_id` estiver preenchido |
| `src/components/tst-prazos/TstPrazoDetailSheet.tsx` | Sheet com todos os campos + link "Ver Processo" se vinculado |
| `src/components/tst-prazos/TstPrazoFormDialog.tsx` | **Formulário de cadastro/edição** com todos os campos da planilha: processo, dossiê, réu, autor, equipe, decisão, formulário, providências, dep. judicial, preparo, multa/custas, responsável, data fatal. Select de coordenação. Busca de processo existente no Supabase para vincular `processo_id` |
| `src/components/tst-prazos/TstImportDialog.tsx` | Upload XLSX com parsing via `xlsx` |
| `src/hooks/usePrazosTst.ts` | Hook React Query: listar (filtro coordenação), criar, atualizar, deletar |

### 5. Kanban — lógica de colunas

Dias corridos até `data_fatal`:
- **≥ 5** → "Mais de 5 dias" (verde)
- **4** → "4 dias" (amarelo)
- **3** → "3 dias" (laranja)
- **2** → "2 dias" (vermelho claro)
- **≤ 1 ou vencido** → "Prazo Fatal" (vermelho intenso)

### 6. Formulário de cadastro

Dialog com campos:
- **Coordenação** (select)
- **Número do Processo** (text, com busca para vincular `processo_id` automaticamente)
- **Dossiê, Réu, Autor, Equipe** (text)
- **Decisão, Formulário, Providências** (textarea)
- **Depósito Judicial, Preparo, Multa/Custas** (text)
- **Responsável** (text ou select de profiles)
- **Data Fatal** (datepicker, obrigatório)

Ao salvar, se o número do processo for encontrado na tabela `processos`, vincula automaticamente o `processo_id`.

### 7. Link para detalhes do processo

- No card e no sheet de detalhes: se `processo_id` estiver preenchido, exibir botão "Ver Processo" que navega para `/processos/:processo_id`
- Na importação XLSX: tentar fazer match do `numero_processo` com a tabela `processos` para preencher `processo_id` automaticamente

### 8. Importação XLSX

- Mapeia colunas: FATAL→data_fatal, DOSSIÊ→dossie, PROCESSO→numero_processo, etc.
- Vincula à coordenação selecionada
- Faz match automático com processos existentes para preencher `processo_id`
- Opção de limpar dados anteriores antes de importar

