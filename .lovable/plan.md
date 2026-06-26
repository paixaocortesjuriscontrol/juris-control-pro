## Objetivo

Criar no **DJEN Local** uma estrutura própria de "Execuções do dia" — totalmente independente do DJEN Servidor — para comparar execuções do mesmo dia e listar as publicações novas em execuções subsequentes. A tela `AnaliseDjen.tsx` ganhará o mesmo card visual da tela do Servidor, mas alimentado por dados próprios.

## Princípio de isolamento

Nada novo é compartilhado com o Servidor. Tabelas, hooks e componentes são exclusivos do Local. O motor do Local nunca lê/escreve tabelas do Servidor e vice-versa.

## 1. Banco (uma migração)

Novas estruturas exclusivas do Local:

- `ALTER TABLE public.publicacoes_djen ADD COLUMN execucao_id uuid` — registra a 1ª execução local que viu a publicação. Índice em `execucao_id`. Nullable (linhas antigas ficam NULL — sem retroatividade).
- `CREATE TABLE public.publicacoes_djen_execucoes (publicacao_id uuid NOT NULL, execucao_id uuid NOT NULL, tipo_engine text NOT NULL, created_at timestamptz default now(), primary key (publicacao_id, execucao_id))`.
  - Índices em `execucao_id` e `publicacao_id`.
  - GRANT `SELECT, INSERT` para `authenticated`; `ALL` para `service_role`.
  - RLS habilitado: `SELECT` para `authenticated`; `INSERT` para `authenticated` (gravação a partir do navegador).
  - Sem FK para `publicacoes_djen` ou `execucoes_agendadas` (mesma postura defensiva já usada em outras tabelas de junção do projeto).

Nenhuma alteração em tabelas do Servidor.

## 2. Engines do Browser registram execução

Locais a alterar (todos já registram a execução em `execucoes_agendadas` e devolvem `executionId`):

- `src/hooks/useDjenTermosParalelaEngine.ts`
- `src/hooks/useDjenTermosKurierEngine.ts`
- `src/hooks/useDjenProcessosEngine.ts`

Para cada um, na hora de gravar publicações em `publicacoes_djen`:

1. Incluir `execucao_id: executionId` no payload do `insert` em massa e no fallback individual.
2. Após o insert bem-sucedido **e** após detectar conflito de unicidade (`23505` — publicação já existia), recuperar o `id` da publicação e gravar em `publicacoes_djen_execucoes` (`upsert` com `ignoreDuplicates`) o trio `{publicacao_id, execucao_id, tipo_engine}` onde `tipo_engine` ∈ `'paralela' | 'kurier' | 'processos'`.
3. Para recuperar o `id` em caso de conflito, usar `.select('id, id_djen, coordenacao_id')` no insert e, quando não vier, um `select` por `(coordenacao_id, id_djen)`.

Nenhuma mudança em comportamento de captura, dedup, escopo ou listagem.

## 3. Frontend — hook próprio

Criar `src/hooks/useExecucoesDoDiaLocal.ts` (arquivo novo, sem reusar o do Servidor):

- Lê `execucoes_agendadas` filtrando `tipo IN ('djen_paralela','djen_kurier','djen_processos')` e `status='concluido'` no dia.
- Faz junção em `publicacoes_djen_execucoes` + `publicacoes_djen!inner` (para aplicar `coordenacao_id` via monitoramento, espelhando o que a página local já faz).
- Devolve interface própria `ExecucaoLocalDoDia` com `{ id, started_at, tipo, tipoEngine: 'paralela' | 'kurier' | 'processos', totalVistas, novasIds, novasCount, primeiraDoDia }`.

## 4. Componente próprio

Criar `src/components/djen/ExecucoesDoDiaLocalCard.tsx` (arquivo novo, sem reuso). Visual igual ao do Servidor (badges, cores indigo, layout 3 colunas), mas usando o hook local e os 3 rótulos de engine (Termos / Kurier / Processos).

## 5. Página `AnaliseDjen.tsx`

- Adicionar estado `execucaoFocada: ExecucaoLocalDoDia | null`.
- Renderizar `<ExecucoesDoDiaLocalCard ... />` logo após o bloco de filtros, idêntico em posição ao da página do Servidor.
- Quando uma execução é focada, filtrar `publicacoes` por `id ∈ execucao.novasIds` (mesma lógica "novas vs. anterior" do Servidor) e exibir badge/limpar filtro.

## Fora de escopo

- Sem migração de histórico — `execucao_id` só aparece em publicações gravadas depois da migração.
- Sem mudanças na tela `AnaliseDjenServidor.tsx`, nem no hook/componente do Servidor.
- Sem alterações em RLS de leitura das publicações.

## Sequência

1. Migração (coluna + tabela + grants + RLS).
2. Gravar `execucao_id` + junção nas 3 engines do browser.
3. Hook + componente novos.
4. Integrar em `AnaliseDjen.tsx`.
