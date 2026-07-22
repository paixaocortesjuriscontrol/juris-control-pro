## Regra unificada de destinatários

Para **todos os tipos** (Prazo, Tarefa, Audiência, Evento, Parcelamento) e **todas as funções de alerta**, o conjunto de destinatários é sempre a **união** de:

- Destinatários selecionados na configuração (quando existir).
- **Responsáveis** do item.
- **Envolvidos** do item.
- **Criador** do item.

Dedupe por usuário; respeita canais habilitados em `config_notificacoes_usuario` (email/whatsapp) e opt-outs específicos por evento.

## 1. `enviar-alertas-tarefas` (digest diário por coordenação/tipo)

- Coletar itens do dia por `cfg.tipo_tarefa`:
  - **TAREFA / PRAZO**: `tarefas` filtradas por `tipo_tarefa`.
  - **AUDIÊNCIA**: `audiencias_detectadas`.
  - **EVENTO**: `eventos_agenda`.
  - **PARCELAMENTO**: `parcelas_evento` do dia + evento pai.
- Para cada item, montar `Set<usuario_id>`:
  - Tarefa/Prazo: `responsavel_id` + `tarefa_responsaveis` + `tarefa_envolvidos` + `criado_por`.
  - Audiência: `audiencias_advogados` + `audiencia_envolvidos` + `criado_por`.
  - Evento: `evento_responsaveis` + `evento_envolvidos` + `participantes_evento` + `criado_por`.
  - Parcelamento: mesmos do evento pai + `criado_por`.
- Destinatários finais = `cfg.destinatarios_ids ∪ idsColetados` (dedup).
- Mesmo digest para todos, dedup diário em `historico_alertas_enviados`.

## 2. `alertar-audiencias`

Substituir o bloco atual (advogados + criador + destinatários específicos OU todos os membros da coordenação) por:

- `audiencias_advogados.advogado_id`
- `audiencia_envolvidos.usuario_id`
- `criado_por`
- `processo.advogado_responsavel_id`
- `config_deteccao_coordenacao.destinatarios_audiencias_ids` (união, não fallback)

Remover o fallback "todos os membros da coordenação" — a regra pede união com destinatários da config, não substituição por membros.

## 3. `alertar-prazos-perdidos`

Hoje agrupa apenas por `responsavel_id` + `tarefa_responsaveis`. Adicionar ao `Set`:

- `tarefa_envolvidos.usuario_id`
- `criado_por`
- Destinatários da config de "prazo perdido" da coordenação, se houver (se não existir campo, apenas união dos três acima).

Manter dedup por dia via `historico_alertas_enviados` (tipo `prazo_perdido`).

## 4. `processar-lembretes-audiencia` (WhatsApp X min antes)

Hoje envia só para o telefone do `criado_por`. Passar a coletar telefones de:

- `criado_por`
- `audiencias_advogados.advogado_id` → `profiles.telefone`
- `audiencia_envolvidos.usuario_id` → `profiles.telefone`
- `processo.advogado_responsavel_id` → `profiles.telefone`
- `config_deteccao_coordenacao.destinatarios_audiencias_ids` (união)

Dedup por telefone formatado; enviar a mesma mensagem para cada.

## Fora de escopo

- Sem mudanças de schema.
- Sem mudanças de UI.
- Sem retroativo.

## Verificação

- Invocar `enviar-alertas-tarefas` e `alertar-audiencias` manualmente e conferir `historico_alertas_enviados` / `notificacoes`.
- Caso concreto: Jéssica Alves (responsável) deve receber mesmo sem estar em destinatários; Eduardo Torres só recebe se estiver em destinatários, responsáveis ou envolvidos.
