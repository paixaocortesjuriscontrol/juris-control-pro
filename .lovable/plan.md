
# Plano de melhorias – Coordenação Dra. Beatriz

Entrega em **4 fases**, aprovando cada uma antes de seguir. Reaproveita a infraestrutura já existente de e-mail e WhatsApp (`enviar-whatsapp-zapi`, funções `enviar-alertas-*`, `notificar-*`).

---

## Fase 1 — Quick wins (baixo risco, alto impacto)

Objetivo: entregas visíveis na tela em pouco tempo, sem mexer em motor de notificações.

1. **Análise DJEN — marcar como lida sem reload**
   Atualização otimista da lista (mutate cache do React Query, sem `invalidateQueries` que recarrega tudo). A publicação some/muda de estilo instantaneamente.

2. **Painel de Controle — retirar tratados dos contadores**
   Nos cards *Prazos, Audiências, Parcelamento, Eventos*, o número no topo passa a contar apenas itens não tratados (usa `isItemTratado` já existente).

3. **Painel de Controle — retirar tratados do Kanban**
   Itens tratados deixam de aparecer nas colunas dos cards. (Ficam acessíveis via filtro "mostrar tratados", opcional.)

4. **Painel de Controle — botão 👁 para ocultar totalizadores**
   Toggle no topo do painel que oculta/mostra a faixa de cards totalizadores. Preferência salva em `localStorage` por usuário.

5. **Painel de Controle — botão Notificações só para admin/coordenador**
   Esconder o botão para demais papéis usando `useUserRole().isAdminOrCoordinator`.

---

## Fase 2 — Notificações individualizadas e alertas de mudança/perda

Objetivo: cada membro escolhe como/quando ser avisado; sistema avisa mudanças de situação e prazos perdidos usando WhatsApp/e-mail **já configurados**.

6. **Config individual de notificações por membro** (dentro do botão "Notificações" do Painel de Controle)
   - Nova tabela `config_notificacoes_usuario` (por usuário): canais habilitados (email/whatsapp/in-app), tipos de evento (mudança de situação, prazo perdido, tarefa nova, comentário, etc.), janela de envio (horário útil).
   - UI: aba "Meu perfil de notificações" com switches por tipo e canal.
   - Admin/coord vê configuração dos membros da coordenação (somente leitura + poder resetar).

7. **Alerta de mudança de situação** (tarefa, prazo, evento, audiência, parcelamento — tudo que sai do botão Adicionar)
   - Trigger em cada tabela: quando `status`/`situacao` muda, enfileira notificação.
   - Nova função edge `notificar-mudanca-situacao` que resolve responsáveis e dispara via `enviar-whatsapp-zapi` e e-mail conforme a config individual.

8. **Alerta de prazo perdido**
   - Cron diário identifica itens vencidos e ainda não tratados dos responsáveis.
   - Envia lembrete e-mail + WhatsApp: "Você tem X pendências vencidas — abra o sistema para tratar".
   - Não repete o mesmo item mais de 1x/dia por usuário (`historico_alertas_enviados`).

---

## Fase 3 — Automação IA + títulos pré-prontos + relatório

9. **Análise DJEN — botão "Pré-agendar tarefas com IA"**
   - Analisa publicações do dia (filtradas na tela) com IA (padrão do projeto).
   - Para cada publicação, propõe: tipo (tarefa/prazo/audiência/evento), título, data sugerida, responsável sugerido.
   - Abre modal de revisão em lote; usuário confirma/edita e o sistema cria os itens vinculados à publicação.

10. **Coordenações — títulos pré-prontos**
    - Nova aba no menu Coordenações: CRUD de "Modelos de título" com campos: nome, tipo (tarefa/prazo/evento/audiência/parcelamento), título template, descrição template, prioridade padrão.
    - Nos formulários de novo item, um seletor "Usar modelo" preenche os campos.

11. **Painel de Controle — Relatório de Audiências**
    - Botão abre modal com filtro Ano/Mês (default: mês atual).
    - Tabela: linhas = usuários da coordenação; colunas = situações (realizada, adiada, cancelada, pendente…); célula = contagem.
    - Totais por linha/coluna; exportação em Excel/PDF (reaproveita utils existentes).

---

## Fase 4 — Reagendar vs Nova audiência

12. **Formulário de alteração de audiência**
    - Botão **Reagendar**: edita o mesmo registro, apenas data/hora/tipo; grava linha em `historico_reagendamentos_audiencia` (data anterior, nova, quem, quando). Sem duplicar.
    - Botão **Nova audiência**: cria novo registro copiando os campos da atual, exigindo nova data/hora/tipo; vincula "originada de" a atual.
    - Fluxo dispara Fase 2 (alerta de mudança de situação para os responsáveis).

---

## Detalhes técnicos

```text
Tabelas novas (Fase 2/3/4):
  config_notificacoes_usuario   (usuario_id, canal, tipo_evento, ativo, janela_horario)
  modelos_titulo_coordenacao    (coordenacao_id, tipo, titulo, descricao, prioridade)
  historico_reagendamentos_aud  (audiencia_id, data_anterior, data_nova, tipo_anterior, tipo_novo, alterado_por, alterado_em)

Triggers:
  after_update_status em: tarefas, eventos_agenda, audiencias_detectadas, prazos, parcelas_evento
    → INSERT em fila (notificacoes) + invoca notificar-mudanca-situacao

Edge functions novas:
  notificar-mudanca-situacao   (dispatcher: lê config do usuário, chama enviar-whatsapp-zapi + email)
  alertar-prazos-perdidos      (cron diário; reaproveita enviar-alertas-tarefas)
  ia-preagendar-djen           (IA analisa publicações e retorna sugestões estruturadas)

Reuso:
  - enviar-whatsapp-zapi (já existe, WhatsApp funcionando hoje)
  - enviar-alertas-tarefas / enviar-alerta-coordenacao (padrão e-mail)
  - useUserRole().isAdminOrCoordinator para gates de UI
  - isItemTratado (src/components/shared/TratadoCheck.tsx) para todos os filtros de "tratados"
```

---

## Ordem sugerida de aprovação

Fase 1 → validar em produção → Fase 2 → Fase 3 → Fase 4.
Se preferir outra ordem (ex.: começar por Reagendar), me avise.
