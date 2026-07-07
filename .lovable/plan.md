# Plano de Implementação

## 1) Check verde ✅ em itens tratados (Painel de Controle)

Locais afetados: cards do resumo, listas (tarefas/prazos/eventos/audiências) e calendário.

- **Tarefas/Prazos**: exibir `CheckCircle2` verde ao lado do título quando `status = 'concluida'` ou `situacao = 'tratado'`.
- **Audiências (`audiencias_detectadas`)**: check verde quando `status_tratamento = 'tratado'`.
- **Eventos (`eventos_agenda`)**: check verde quando `status = 'concluido'`.
- **Calendário do Painel**: adicionar badge/ícone verde no dia do evento quando todos os itens do dia estiverem tratados; itens individuais mostram ✅ na tooltip/popover.
- Componente reutilizável `<TratadoCheck />` para manter consistência visual.

## 2) Pré-selecionar Coordenação padrão do usuário logado

Em todos os formulários que têm `CoordenacaoSelect` para adicionar responsável/colaborador/envolvido:
- Buscar `membros_coordenacao` do usuário logado, ordenado pela criação (a primeira/principal).
- Aplicar como `defaultValue` nos formulários: tarefa, evento, audiência, prazo, delegação, vincular.
- Criar hook `useCoordenacaoPadraoUsuario()` para centralizar.

## 3) Filtro por tipo em "Prazos Fatais"

Na página `PrazosFatais` (kanban integrado):
- Adicionar `<Select>` no topo com opções: Todos, Tarefa, Prazo, Evento, Audiência, Publicação.
- Filtro aplicado antes de distribuir os itens nas colunas do Kanban.
- Persistir no state local (sem URL param nesta fase).

## 4) Configuração de alertas por Coordenação (E-mail + WhatsApp por tipo)

Nova tela acessada por botão **"Configurar Alertas"** em `Coordenacoes.tsx` (ao lado do "Pautas Excel"), abrindo dialog `ConfigAlertasEnvioDialog`.

**Estrutura da config (por tipo de tarefa)**:
- Tipo (PRAZO, AUDIÊNCIA, EVENTO, TAREFA EQUIPE, etc. — usar `TIPOS_TAREFA`).
- Canais: `email`, `whatsapp`, ou ambos.
- Régua de dias: checkboxes "No dia", "1 dia antes", "2 dias antes", "3 dias antes", "5 dias antes", "7 dias antes" + campo custom "Outros dias" (lista separada por vírgula).
- Destinatários: multi-select de membros da coordenação (reaproveita PeoplePicker).

**Nova tabela** `config_envio_alertas_tarefas`:
```
id uuid, coordenacao_id uuid, tipo_tarefa text,
canal_email bool, canal_whatsapp bool,
dias_antes int[],                  -- [0,1,2,3,5,7,...]
destinatarios_ids uuid[],
ativo bool, created_by, created_at, updated_at
UNIQUE(coordenacao_id, tipo_tarefa)
```
+ GRANTS + RLS por membros da coordenação.

Reusa a integração WhatsApp já configurada em `AlertasCoordenacaoCard` (mesmo provider/edge function de envio).

## 5) Edge function diária de envio (sem browser aberto)

**Nova edge function** `enviar-alertas-tarefas` (Supabase Edge + cron `pg_cron` diário às 07:00 BRT):
- Lê `config_envio_alertas_tarefas` ativas.
- Para cada config, calcula alvos: itens de `tarefas`, `eventos_agenda`, `audiencias_detectadas` cuja data cai exatamente em `hoje + N` para cada N em `dias_antes`.
- Filtra apenas itens da `coordenacao_id` e do `tipo_tarefa` correspondente (tarefas: `tipo_tarefa`; audiências: tipo AUDIÊNCIA; eventos: mapear).
- Deduplica via `historico_alertas_enviados` (não reenviar mesmo `referencia_id + canal + destinatario + data`).
- Envia:
  - **E-mail**: via provider já configurado no projeto.
  - **WhatsApp**: mesma integração usada por `AlertasCoordenacaoCard` (DJEN).
- Grava sucesso/falha em `historico_alertas_enviados`.
- Cron via `pg_cron` + `pg_net` chamando a function 1x ao dia.

## 6) Datas sempre visíveis no Kanban

- `AudienciasKanbanBoard` / `AudienciaKanbanCard`: mover `data_audiencia` (formatada `dd/MM/yyyy HH:mm`) para linha fixa abaixo do título — não em tooltip nem em hover.
- Mesma alteração no Kanban de Prazos Fatais (`PrazosFataisKanban`) e no TST Kanban se aplicável: badge com data sempre visível.

## Detalhes técnicos

- Types: usar constantes já existentes (`TIPOS_TAREFA`, `TIPOS_TAREFA_LABELS`).
- RLS: policies iguais ao padrão de `alertas_coordenacao_djen` (membros da coordenação + admin).
- Sem quebra de schema em tabelas existentes; só uma nova tabela.
- Frontend usa `useMutation` com `await queryClient.invalidateQueries` antes de fechar modais (padrão do projeto).
- Componente `<TratadoCheck size="sm" />` em `src/components/shared/`.

## Ordem de execução

1. Migration da nova tabela + GRANTS + RLS.
2. `<TratadoCheck />` e integração nos cards/listas/calendário do Painel (item 1).
3. Hook `useCoordenacaoPadraoUsuario` + aplicação nos forms (item 2).
4. Filtro por tipo em Prazos Fatais (item 3).
5. Datas visíveis nos Kanbans (item 6).
6. Dialog `ConfigAlertasEnvioDialog` + botão em `Coordenacoes` (item 4).
7. Edge function `enviar-alertas-tarefas` + cron (item 5).
