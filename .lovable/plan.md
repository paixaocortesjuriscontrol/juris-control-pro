
## Objetivo

Permitir marcar processos como **Acompanhamento Especial**, fazendo a Judit consultar diariamente (na frequência definida pelo advogado) os andamentos — e opcionalmente baixar anexos — gerando notificação, tarefa e destaque visual.

## 1. Banco de dados

Migration adicionando em `public.processos`:

- `acompanhamento_especial boolean default false`
- `acompanhamento_freq_diaria smallint default 1` (1 a 6 — quantas vezes ao dia)
- `acompanhamento_com_anexos boolean default false`
- `acompanhamento_ativado_em timestamptz`
- `acompanhamento_ultima_checagem_em timestamptz`
- `acompanhamento_ultimo_step_date timestamptz` (para detectar novidades)

Nova tabela `public.acompanhamento_especial_eventos` (histórico do que a Judit trouxe de novo):
- `id`, `processo_id` (FK), `step_id`, `step_date`, `conteudo`, `instancia`, `tribunal`, `anexos_count`, `criou_tarefa_id`, `notificou_em`, `criado_em`.
- GRANTs para `authenticated` (SELECT) e `service_role` (ALL); RLS por coordenação do processo.

## 2. Toggle na tela do processo

Em `src/components/processos/` (ao lado de `MonitoramentoToggle`): novo componente `AcompanhamentoEspecialToggle` com:

- Switch principal "Acompanhamento Especial".
- Quando ligado, expande: input numérico (1–6) "vezes por dia" + switch "Baixar anexos automaticamente".
- Salva direto em `processos` com toast de confirmação.

## 3. Edge Function `judit-acompanhamento-especial`

Reaproveita o padrão já existente em `judit-processo-interno`:

1. Lista processos com `acompanhamento_especial = true` cuja última checagem é mais antiga que `24h / freq`.
2. Para cada um, chama Judit (`with_attachments` conforme flag do processo).
3. Compara `steps` retornados contra `acompanhamento_ultimo_step_date`. Só os mais novos são considerados.
4. Para cada novo step:
   - Insere em `acompanhamento_especial_eventos`.
   - Cria notificação em `notificacoes` para o(s) responsável(is) do processo (sino).
   - Cria tarefa em `tarefas` vinculada ao processo (tipo "Acompanhar andamento") atribuída ao responsável.
   - Envia e-mail via app emails (template `acompanhamento-especial-novidade`) ao responsável.
5. Se houve anexos novos e a flag estiver ligada, persiste em `judit_anexos`.
6. Atualiza `acompanhamento_ultima_checagem_em` e `acompanhamento_ultimo_step_date`.

## 4. Agendamento (pg_cron)

Um único cron rodando de hora em hora chama a edge function. A função decide quais processos processar pela conta `(24 / freq)` desde a última checagem — assim respeita a frequência individual sem precisar de cron por processo.

## 5. Exibição no Painel de Controle

Novo card "Acompanhamento Especial — Novidades" em `src/pages/Index.tsx` (Painel) listando os últimos eventos não lidos da coordenação do usuário (top 10 + link "ver tudo"). Cada item: processo, data do andamento, trecho do conteúdo, badge se trouxe anexo, ação "marcar como lido".

## 6. Aba "Andamentos" no detalhe do processo

Em `src/components/processos/` (aba de andamentos do processo aberto): seção destacada "Acompanhamento Especial" mostrando os eventos de `acompanhamento_especial_eventos` daquele processo em ordem cronológica, com indicador visual diferenciado dos demais andamentos.

## 7. Notificações e tarefas

- **Sino**: insere em `notificacoes` com `tipo = 'acompanhamento_especial'`, link direto pro processo.
- **Tarefa**: insere em `tarefas` (`tipo` "Acompanhar andamento", prazo +2 dias úteis, responsável = responsável do processo).
- **E-mail**: template React Email novo `acompanhamento-especial-novidade.tsx` com número do processo, data do andamento, resumo e botão "Abrir processo".

## 8. Custos Judit

Aviso visível ao ligar o toggle: "Cada checagem consome créditos Judit. Frequência alta multiplica o consumo." Anexos = consumo adicional.

## Detalhes técnicos

- Edge function: Deno, `verify_jwt = true`, importa `npm:@supabase/supabase-js@2`, usa `JUDIT_API_KEY` já configurado.
- Detecção de novidade: `step_date > acompanhamento_ultimo_step_date` (UTC).
- Idempotência: chave única `(processo_id, step_id)` em `acompanhamento_especial_eventos` evita duplicar notificação se a Judit reenviar o mesmo step.
- E-mail: idempotency key `acomp-esp-<processo_id>-<step_id>`.
- Respeita isolamento por coordenação (memória `coordination-data-isolation`).
- Sem leitura de `publicacoes_djen*` (não relacionado).
- Tarefa criada respeita `tarefa_responsaveis` (pode ter mais de um).

## Fora de escopo nesta primeira versão

- Marcação em lote na lista de processos (fica para depois, conforme resposta do usuário — só toggle individual agora).
- Regras automáticas (valor da causa, cliente).
- Dashboard de consumo Judit por processo (pode ser adicionado depois).
