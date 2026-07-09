## 1) Alerta do form somando ao existente — em todos os tipos que têm esse campo

Locais com o campo "Alertas internos de antecedência" hoje:

| Tipo | Arquivo | Situação atual |
|---|---|---|
| Audiência | `src/hooks/useAudienciasDetectadas.ts` (mutation `criarAudiencia`) | Bug: valor do form é ignorado; só usa `config_alertas_audiencias.lembretes_minutos` global. |
| Evento | `src/hooks/useEventosAgenda.ts` (`useCreateEvento`/`useUpdateEvento`) | Insere só o `alerta_minutos` vindo do form; não soma nada global. |
| Parcelamento | `src/components/agenda/GerarParcelasDialog.tsx` | Insere só o `alerta_minutos` do form em `alertas_parcela`; não soma nada global. |

Ajustes:

- **Audiência (`useAudienciasDetectadas.ts`)**: no bloco de criação de `lembretes_audiencia`, converter `alerta_valor`+`alerta_unidade` do form em minutos (`minutos_antes = valor`, `horas_antes = valor*60`, `dias_antes = valor*1440`) e concatenar ao array vindo de `config.lembretes_minutos`. Deduplicar com `Set` antes de inserir. Fazer o mesmo em `atualizarAudiencia` quando o campo for editado (deletar lembretes não enviados dessa audiência e recriar somando).
- **Evento (`useEventosAgenda.ts`)** e **Parcelamento (`GerarParcelasDialog.tsx`)**: como não existe config global paralela, "somar ao existente" equivale a preservar o comportamento atual — mantém como está, sem regressão. Apenas garantir que em modo edição o array `alerta_minutos` do form seja mesclado (`Set`) com os alertas já existentes na tabela em vez de sobrescrever (hoje `useUpdateEvento` faz `delete` + `insert` do que veio do form; passar a fazer `delete apenas dos não-enviados` e `insert` da união com os já registrados).
- Nada muda no envio: os edge functions `processar-lembretes-audiencia`, `processar-alertas-evento`/`alertar-audiencias` já leem as tabelas de lembretes e disparam pelo Z-API/notificação.

## 2) Evento recorrente não aparece várias vezes no calendário

Causa: `src/hooks/useAgendaUnificada.ts` insere no calendário **apenas** um item por linha de `eventos_agenda` (só na `data_inicio` original). Os campos `recorrencia_tipo`, `recorrencia_intervalo`, `recorrencia_fim`, `recorrencia_dias_semana` são gravados na base, mas nunca são expandidos em ocorrências virtuais.

Ajuste em `useAgendaUnificada.ts`, no laço `for (const evento of eventosFiltered)`:

- Se `evento.recorrente && evento.recorrencia_tipo` (e não for parcelamento — parcelamento já cria uma linha por parcela), gerar ocorrências entre `filters.dataInicio` e `filters.dataFim` (limitado por `recorrencia_fim` quando presente):
  - `diaria`: soma `recorrencia_intervalo` dias.
  - `semanal`: soma `intervalo * 7` dias. Se `recorrencia_dias_semana` existir, expandir para cada dia da semana marcado dentro da janela.
  - `mensal`: soma `intervalo` meses (`date-fns/addMonths`), preservando o dia da `data_inicio`.
  - `anual`: soma `intervalo` anos.
- Cada ocorrência vira um `ItemAgendaUnificado` novo com `id = \`${evento.id}::${dataISO}\``, `data_inicio`/`data_fim` deslocados, e um marcador `recorrencia_pai_id = evento.id`. A ocorrência original (`data_inicio` cru) é apenas a primeira.
- `EdicaoItemPanel.tsx` já resolve edição pelo evento-pai: adicionar um `stripRecorrenciaSuffix` no `useEffect` que carrega o evento para tolerar ids com `::data`.
- `seenIds` continua deduplicando pelo id composto para não repetir a mesma data.
- Segurança: cap de 500 ocorrências por evento na expansão para evitar loop se `recorrencia_fim` estiver vazio (usa `filters.dataFim` ou hoje+2 anos como teto).

## 3) Parcelamento recorrente — restringir coordenações

Arquivo: `src/components/agenda/GerarParcelasDialog.tsx` (linhas ~64, 91-101, 82, 87).

Hoje: `useQuery(["coordenacoes-parcelas"])` busca **todas** as coordenações do banco; três selects (`coordenacaoId`, `coordenacaoProcessoFiltro`, `coordenacaoFiltro`) usam essa lista sem filtrar por membro/admin.

Ajuste:

- Substituir a query por filtragem baseada em `useUserRole().isAdmin` + `useCoordenacoesDoUsuario()`:
  - Admin: query atual (todas, ordenadas por nome).
  - Não-admin: `select coordenacoes.id, nome from coordenacoes inner join membros_coordenacao on ... where membros_coordenacao.usuario_id = auth.uid()`.
- Autoseleção quando o usuário só tem uma coordenação:
  - `coordenacaoId`: já é auto-preenchido via `unicaCoordenacaoId` no `useEffect` de inicialização — manter.
  - `coordenacaoProcessoFiltro` e `coordenacaoFiltro`: inicializar como `unicaCoordenacaoId` quando houver, em vez do default `"todas"`; se admin ou múltiplas, mantém `"todas"`.
- Trocar o `CoordenacaoSelect` já usado (linha 627) e os `<Select>` dos filtros (686/765) para consumir a nova lista escopada.
- Nenhuma mudança em RLS; a filtragem é apenas de UI (a base já isola via policies das outras tabelas).

## Arquivos alterados

- `src/hooks/useAudienciasDetectadas.ts`
- `src/hooks/useEventosAgenda.ts`
- `src/hooks/useAgendaUnificada.ts`
- `src/components/agenda/GerarParcelasDialog.tsx`
- `src/components/agenda/EdicaoItemPanel.tsx` (tolerar id composto de ocorrência)

Sem migrations — o schema já suporta tudo (`recorrencia_*` já existe, `lembretes_audiencia`/`alertas_evento`/`alertas_parcela` já existem).
