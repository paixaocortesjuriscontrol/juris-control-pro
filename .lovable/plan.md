
## Escopo

Aplicar duas mudanças em **todos os formulários abertos pelo botão "Adicionar"** do Painel de Controle e da Análise DJEN (Tarefa, Prazo, Evento, Audiência).

---

## 1) Recorrência em Tarefa e Prazo

Hoje só **Evento** tem recorrência. Vamos replicar o mesmo bloco em **Tarefa** (`NovaTarefaDialog`) e **Prazo** (`PrazoDialog`), com duas opções de frequência principais:

- **Dias corridos** (diariamente, incluindo fins de semana)
- **Dias úteis** (seg–sex)

Mais as demais opções que já existem em Evento (Semanal, Mensal, Anual) para paridade.

O usuário informa:
- Frequência (Não se repete / Dias corridos / Dias úteis / Semanal / Mensal / Anual)
- Quantas vezes deve aparecer **ou** data-fim
- Intervalo (padrão 1)

### Banco (migration)

Adicionar em `public.tarefas` os mesmos campos que já existem em `eventos_agenda`:

```sql
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS recorrente boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recorrencia_tipo text,       -- 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'
  ADD COLUMN IF NOT EXISTS recorrencia_intervalo int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recorrencia_fim date,
  ADD COLUMN IF NOT EXISTS recorrencia_rrule text;
```

### Replicação no calendário

`src/hooks/useAgendaUnificada.ts` — no bloco que empurra tarefas para `resultItems` (~linha 711), quando `recorrente=true` e `recorrencia_tipo` estiver preenchido, expandir a tarefa em várias ocorrências dentro da janela (mesma lógica já usada para eventos: cursor incremental por `daily`/`weekdays`/`weekly`/`monthly`/`yearly`, respeitando `recorrencia_fim`). Cada ocorrência recebe `recorrencia_pai_id = tarefa.id` para dedup/edição.

Mesma expansão vale para prazos (que também são registros na tabela `tarefas`, com `tipo_tarefa='PRAZO'`).

### UI

- `NovaTarefaDialog.tsx`: adicionar bloco "Recorrência" acima do bloco de anexos, idêntico ao do `EventoDialog` (com "Dias corridos" e "Dias úteis" renomeando "Diariamente"/"Dias úteis (Seg–Sex)"). Persistir os novos campos no INSERT/UPDATE em `tarefas`.
- `PrazoDialog.tsx`: mesmo bloco, logo antes de "Observações". Persistir via `useCreatePrazo`/`useUpdatePrazo` (adicionar campos no payload).

---

## 2) Remoção do campo "dias de alerta antes"

Nos formulários **Tarefa, Prazo, Evento e Audiência**, remover o(s) input(s) de "alerta X dias antes" e substituir por um card informativo:

```
🔔 Alertas configuráveis
Configure quando e como receber lembretes deste item no botão
"Notificações" do Painel de Controle.
```

Arquivos afetados:

- `src/components/prazos/PrazoDialog.tsx` — remove o bloco `Alerta` (linhas ~547–567) e para de enviar `alerta_dias`/`alerta_unidade` no payload (fica `null`).
- `src/components/agenda/EventoDialog.tsx` — remove o(s) campo(s) de "lembrete" / "alertar X min/horas antes".
- `src/components/audiencias/AudienciaFormSimplificado.tsx` — remove seletor de "lembrete antes".
- `src/components/delegacao/NovaTarefaDialog.tsx` — remove qualquer campo equivalente, se existir.

O card explicativo é um componente compartilhado novo `src/components/shared/AlertasConfigCard.tsx` reutilizado em todos os quatro formulários.

Os dados de alerta já configurados em registros antigos ficam intactos no banco (não são apagados) — apenas deixam de ser editáveis por esses formulários.

---

## Detalhes técnicos

- Migration: apenas `ADD COLUMN IF NOT EXISTS`, sem GRANT novo (grants já existem em `tarefas`).
- `recorrencia_rrule` é montado no submit exatamente como em `EventoDialog` (`FREQ=…;INTERVAL=…;UNTIL=…`).
- Em `useAgendaUnificada`, ampliar a query de tarefas para trazer as novas colunas e reproduzir o loop de expansão já existente para eventos, respeitando a janela `windowStart`/`windowEnd`.
- Não alteramos lógica de notificação/envio de alertas — apenas o formulário. A configuração continua via tela de Notificações do Painel.

---

## Arquivos alterados

- `supabase/migrations/<nova>.sql` (migration)
- `src/components/delegacao/NovaTarefaDialog.tsx`
- `src/components/prazos/PrazoDialog.tsx`
- `src/components/agenda/EventoDialog.tsx`
- `src/components/audiencias/AudienciaFormSimplificado.tsx`
- `src/components/shared/AlertasConfigCard.tsx` (novo)
- `src/hooks/useAgendaUnificada.ts`
- `src/hooks/usePrazos.ts` (aceitar novos campos no payload)
