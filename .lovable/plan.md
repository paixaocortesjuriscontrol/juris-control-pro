## Regra única (aplicada aos 5 formulários do botão "+ Adicionar")

Regra do seletor "Coordenação":

- **Admin** OU **usuário com >1 coordenação** → mostra o select (obrigatório escolher).
- **Usuário com exatamente 1 coordenação** → **não** mostra o select. O sistema vincula automaticamente à coordenação do usuário logado, tanto na inclusão quanto na edição.
- Formulários afetados: **Tarefa, Evento, Prazo, Audiência, Parcelamento recorrente**.
- Ao abrir o form, os pickers de **processo** e **responsáveis** já vêm filtrados pela coordenação vinculada (única do usuário, ou a selecionada no topo do form).

## Banco (migração)

Adicionar coluna `coordenacao_id uuid` (FK → `coordenacoes.id`, `ON DELETE SET NULL`) nas tabelas que hoje não têm:

- `public.tarefas`
- `public.eventos_agenda`

(`audiencias_detectadas` já tem `coordenacao_id`; parcelamento é linha em `eventos_agenda`; prazo TST é derivado de `processos.data_fatal` e não muda de tabela.)

Trigger `BEFORE INSERT OR UPDATE` em `tarefas` e `eventos_agenda`:

1. Se `processo_id` presente → `coordenacao_id := processos.coordenacao_id`.
2. Senão, se `coordenacao_id` veio no payload → mantém.
3. Senão, deriva da coordenação do `criado_por` via `membros_coordenacao` (pega a única; se houver mais de uma e nenhuma foi enviada, deixa NULL — o front garante o valor nesse caso).

Backfill: preencher `coordenacao_id` das linhas existentes via `processos.coordenacao_id`; onde não houver processo, via `membros_coordenacao` do `criado_por` (só quando o usuário tem exatamente uma coordenação).

Índices: `idx_tarefas_coordenacao_id`, `idx_eventos_agenda_coordenacao_id`.

## Front (mesmo padrão em todos os 5 forms)

Novo hook utilitário `useCoordenacoesDoUsuario()` (baseado em `useUserRole` + `membros_coordenacao`) que retorna:

```
{ isAdmin, coordenacoes: [...], unicaCoordenacaoId, precisaSelecionar }
```

- `precisaSelecionar = isAdmin || coordenacoes.length > 1`.
- `unicaCoordenacaoId = coordenacoes.length === 1 ? coordenacoes[0].id : null`.

Em cada dialog (`NovaTarefaDialog`, `EventoDialog`, `PrazoDialog`/prazo do menu Adicionar, `CadastroAudienciaForm`/`AudienciaFormSimplificado`, `GerarParcelasDialog`):

1. Ler `useCoordenacoesDoUsuario()`.
2. Renderizar o `<CoordenacaoSelect>` apenas quando `precisaSelecionar === true`.
3. Quando **oculto**, injetar `unicaCoordenacaoId` no state do form no mount e usá-lo diretamente no insert/update.
4. Quando **visível**, manter comportamento atual (obrigatório escolher). Para admin, se houver processo vinculado, pré-selecionar a coordenação do processo — mas o admin pode trocar.
5. Nos pickers de **processo** e **responsáveis**, aplicar filtro por `coordenacao_id` do valor efetivo (unica ou selecionada).
6. Enviar `coordenacao_id` no `insert`/`update` de `tarefas` e `eventos_agenda`. O trigger reconcilia com o processo, se houver.
7. Na edição, se o registro veio sem `coordenacao_id` (dado antigo), preencher com `unicaCoordenacaoId` do usuário logado quando `!precisaSelecionar`.

## Impacto no filtro do admin (Painel de Controle)

Como `tarefas` e `eventos_agenda` passam a ter `coordenacao_id` próprio, o filtro do admin "Escritório → Coordenação X" volta a encontrar itens sem processo. Ajustes:

- `useAgendaUnificada.ts`: adicionar `OR tarefas.coordenacao_id = X` e `OR eventos_agenda.coordenacao_id = X` ao filtro por coordenação (hoje só via `processos!inner.coordenacao_id`).
- `PainelControle.tsx`: cards de resumo passam a filtrar por `coordenacao_id` direto na tabela também.

## Fora do escopo

- Redistribuir itens entre coordenações em massa.
- Mexer em RLS existente (o novo caminho respeita as políticas atuais — usuário só vê a própria coordenação; admin vê tudo).
- Redesign visual dos forms; apenas condicionar a exibição do campo Coordenação.

## Resultado

- Usuário com 1 coordenação: abre o "+ Adicionar", escolhe Tarefa/Evento/Prazo/Audiência/Parcelamento, **não vê** campo Coordenação, e o item já sai vinculado à coordenação dele — com processos e responsáveis filtrados para essa coordenação.
- Usuário com várias coordenações ou admin: vê o select no topo, escolhe uma, e o resto do form segue essa escolha.
- No painel do admin, ao filtrar por Escritório + Coordenação, os itens criados por esse fluxo aparecem, mesmo sem processo vinculado.