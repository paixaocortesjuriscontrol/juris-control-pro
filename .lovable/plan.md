## Agendamento múltiplo (até 3x/dia) + retry/refila + card de novas publicações

### 1) UI: até 3 horários por dia (DJEN Termos servidor, Kurier, Pautas)

Trocar o `<Input>` texto-livre vírgula-separado em `src/pages/DjenServidor.tsx` (linhas ~200–225) por um componente novo:

`src/components/djen/HorariosDoDiaPicker.tsx`
- 3 slots fixos (Slot 1 / Slot 2 / Slot 3), cada um `<Input type="time">` BRT.
- Slot vazio = desativado; mínimo 1 ativo.
- Validação: horários únicos, ordenados antes de salvar.
- Aviso visual se algum slot coincidir com horário do DJEN browser (regra de conflito atual já existe e é mantida).
- Usado nos 3 cards (Termos, Kurier, Pautas) com a mesma UX. Backend já aceita `horarios_execucao text[]` — sem migration.

### 2) Backend: retry no item + refila do que falhou

#### 2.1 Retry inline (3 tentativas, backoff exponencial 2s/5s/12s) só para 5xx/timeout

Em `monitor-servidor/engines/paralela.js`, `kurier.js` e `pautas.js`: envolver a chamada `buscarPaginado`/fetch principal por (tribunal × monitoramento) em retry. Status 4xx (401/403/429) continua falha imediata. Mesma política aplicada em `monitor-servidor/proxyPool.js` para 5xx (já marca `markFail`, só falta loop de retry).

#### 2.2 Marcar item como "falho do dia" para refila

Migration nova: tabela `execucoes_servidor_falhas`

```sql
create table public.execucoes_servidor_falhas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,                        -- djen_paralela_servidor | kurier_servidor | djet_pautas_servidor
  execucao_id uuid references public.execucoes_servidor(id) on delete set null,
  item_key text not null,                    -- ex.: "paralela|TJES|<monit_id>" ou "kurier|<credencial_id>" ou "pautas|TST"
  payload jsonb not null,                    -- dados pra reexecutar (tribunal, monitoramento_id, etc.)
  ultimo_erro text,
  tentativas int not null default 1,
  status text not null default 'pendente',   -- pendente | resolvido | abandonado
  dia_brt date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipo, dia_brt, item_key)
);

grant select, insert, update, delete on public.execucoes_servidor_falhas to authenticated;
grant all on public.execucoes_servidor_falhas to service_role;
alter table public.execucoes_servidor_falhas enable row level security;

create policy "select_authenticated" on public.execucoes_servidor_falhas
  for select to authenticated using (true);
create policy "service_role_all" on public.execucoes_servidor_falhas
  for all to service_role using (true) with check (true);
```

Engines passam a fazer `upsert` em `execucoes_servidor_falhas` (com `on conflict (tipo, dia_brt, item_key) do update set tentativas = tentativas+1, ultimo_erro=...`) quando o retry inline esgotar. Ao sucesso, marcam `status='resolvido'`.

#### 2.3 Refila no dispatcher e no início de cada execução

Em `supabase/functions/dispatcher-servidor/index.ts` e/ou no boot de cada engine:
- Antes de varrer a fila normal, ler `execucoes_servidor_falhas` daquele `tipo` + `dia_brt = hoje BRT` + `status='pendente'` + `tentativas < 5` e processar primeiro só esses itens (chamando o engine com payload reduzido).
- Após processar com sucesso → `status='resolvido'`.
- Após 5 tentativas → `status='abandonado'`.

Resultado prático: o caso de hoje (5 publicações TJES/TJAP do monitoramento "OSMAR MENDES PAIXAO CORTES" perdidas por 17 falhas 5xx) seria refilado na próxima janela do dia e capturado.

### 3) Marcar rodada do dia em `execucoes_servidor`

Migration leve: adicionar `rodada_do_dia int` e `slot_horario text` em `execucoes_servidor`. Sem GRANT novo (tabela existente).

Dispatcher conta execuções do dia para o tipo antes de enfileirar e grava `rodada_do_dia` + `slot_horario` (o `h` do loop). RPC `enfileirar_execucao_servidor` recebe 2 params opcionais.

### 4) Card "novas publicações desde a execução anterior" no Análise DJEN

**Atenção importante (lembrete do usuário)**: o DJEN servidor ainda não grava em `publicacoes_djen` (tabela do browser). Hoje o servidor grava em `publicacoes_djen_servidor`. O Análise DJEN lê de `publicacoes_djen`. Para o card refletir o que o servidor capturou, **vou ler de AMBAS as tabelas** dentro do hook, deduplicando por `id_djen` e por `coordenacao_id` — sem mexer no fluxo de gravação atual. (Quando/se quiserem unificar gravação numa única tabela, será item separado.)

`src/hooks/useNovasPublicacoesDoDia.ts`:
- Query `publicacoes_djen` + `publicacoes_djen_servidor` filtrando `coordenacao_id` + `data_disponibilizacao::date = hoje BRT`.
- Junta com `execucoes_servidor` por `execucao_id` para descobrir `rodada_do_dia` e `slot_horario`.
- Retorna: total da rodada 1, rodada 2, rodada 3 e a lista de `id_djen` "novas" (que não existiam antes da primeira rodada do dia).

`src/pages/AnaliseDjen.tsx` ganha, acima da lista, um card amarelo quando há coordenação selecionada e `rodada_do_dia >= 2` trouxe publicações:

```text
🟡  N novas publicações chegaram após a 1ª execução de hoje
    Rodada 2 (14:00) · X novas  ·  Rodada 3 (18:00) · Y novas
    [Ver apenas as novas]   [Marcar como visualizadas]
```

- Por padrão as "novas" sobem para o topo da lista com badge `Nova · 14:00`.
- "Marcar como visualizadas" grava em `localStorage` (chave `djen-novas-vistas:{user}:{coord}:{ymd}`) o último `created_at` visto.

### Fora do escopo

- Não mexer no motor de matching, dedupe, ou `monitorar-termos`/`monitorar-djen`.
- Não unificar `publicacoes_djen` + `publicacoes_djen_servidor` em uma única tabela (item separado, se quiserem depois).
- Não mexer no DJEN browser cron nem em `executar-djet-pautas-agendado` (já lê o array `horarios_execucao` corretamente).

### Arquivos tocados

- `supabase/migrations/` (1 arquivo): cria `execucoes_servidor_falhas` + adiciona colunas `rodada_do_dia`, `slot_horario` em `execucoes_servidor` + atualiza RPC `enfileirar_execucao_servidor`.
- `supabase/functions/dispatcher-servidor/index.ts`: refila falhas pendentes + grava rodada/slot.
- `monitor-servidor/engines/paralela.js`, `kurier.js`, `pautas.js`: retry inline + upsert em `execucoes_servidor_falhas` + leitura de falhas pendentes no boot.
- `monitor-servidor/proxyPool.js`: loop de retry 5xx com backoff exponencial.
- `src/components/djen/HorariosDoDiaPicker.tsx` (novo).
- `src/pages/DjenServidor.tsx`: troca o input texto-livre pelo componente novo nos 3 cards.
- `src/hooks/useNovasPublicacoesDoDia.ts` (novo).
- `src/pages/AnaliseDjen.tsx`: card + ordenação "novas no topo" + integração do hook.
