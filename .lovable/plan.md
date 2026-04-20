

## Nova categoria "Erro Judit" para isolar processos com turma inválida

Criar uma marcação persistente para os processos que a Judit preencheu com uma turma fora da composição oficial do TST (1ª–8ª Turma), permitir filtrá-los na tela de Distribuição TST, e marcar agora os **188 processos** que estão nessa situação. Quando você rodar a busca Judit novamente, o flag será reavaliado automaticamente.

### O que vai ser feito

**1. Coluna de marcação no banco** (`dados_benner.erro_judit boolean default false`)

Migração que:
- Adiciona a coluna `erro_judit` (boolean, default false, não-nulo).
- Cria índice parcial `WHERE erro_judit = true` para o filtro ser rápido.
- Faz backfill: marca `erro_judit = true` nos 188 registros onde `judit_preenchido = true` E `turma` não pertence a `{1ª Turma … 8ª Turma}` (normalizando acentos, número romano, "TURMA"/"Turma" etc.).

**2. Reavaliação automática a cada consulta Judit** (`supabase/functions/consultar-processo-judit/index.ts` e `buscar-judit/index.ts`)

Após calcular `turmaFinal` (já com fallback de mapeamento oficial pelo relator), incluir no `update` da `dados_benner`:
- `erro_judit = true` se a turma final ainda estiver fora da lista oficial **ou** se a Judit retornou turma mas o relator é desconhecido.
- `erro_judit = false` quando a turma final é uma das 8 turmas oficiais.

Assim, na próxima rodada da busca Judit em lote os flags se autocorrigem — quem ficar com turma válida sai da categoria, quem continuar inválido permanece.

**3. Filtro na tela Distribuição TST**

- `src/hooks/useDistribuicoesTst.ts`: adicionar `erroJudit?: "todos" | "sim" | "nao"` em `DistribuicaoTstFilters` e aplicar `query.eq("erro_judit", true/false)`.
- `src/pages/DistribuicaoTst.tsx`: novo `Select` ao lado do filtro "Judit":
  ```text
  Erro Judit: Todos
  Erro Judit: Sim
  Erro Judit: Não
  ```
  Incluir o estado em `clearFilters`, `hasFilters`, `debouncedFilters` e nas dependências do `useEffect`.

**4. Indicador visual (leve)**

- Na tabela, um badge vermelho discreto "Erro Judit" ao lado do nome da turma quando `erro_judit = true`, para tornar óbvio o que precisa ser revisado.

### Critério de "Erro Judit"

Um registro é classificado como erro quando:
- `judit_preenchido = true`, **e**
- após normalização, `turma` ∉ `{"1ª Turma","2ª Turma","3ª Turma","4ª Turma","5ª Turma","6ª Turma","7ª Turma","8ª Turma"}`.

Cobre os casos vistos hoje: `"4 TURMA"` solto, `"SBDI-I"`, `"Subseção"`, `"Presidência"`, `"CEJUSC"`, `"10ª TURMA"`, turmas de TRT etc.

### Detalhes técnicos

- Migração SQL: `ALTER TABLE` + `CREATE INDEX` + `UPDATE` de backfill usando `unaccent + lower + regexp` para validar o conjunto oficial.
- Edge Functions: helper `isTurmaOficialTst(turma)` em `supabase/functions/_shared/extrair-relator.ts`, importado pelas duas funções; `updateData.erro_judit = !isTurmaOficialTst(turmaFinal)`.
- Tipos do Supabase (`src/integrations/supabase/types.ts`) regeneram automaticamente após a migração.
- Não altera RLS (já permite UPDATE para todos os autenticados).

### Resultado esperado

- Os 188 processos atuais ficam marcados como "Erro Judit" e podem ser isolados com um clique no novo filtro.
- Toda nova consulta Judit (individual ou em lote) reavalia o flag, então quem voltar com turma válida sai da categoria sem ação manual.
- Dados existentes preservados (nenhuma turma é apagada — apenas marcada).

