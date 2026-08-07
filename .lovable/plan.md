# Abas nos formulários de itens + sub-atividades

Padronizar os formulários do botão Adicionar (prazo, tarefa, audiência, evento, parcelamento) com um bloco de abas no rodapé do formulário, no estilo do card de referência:

```text
[ Atividades ] [ Comentários ] [ Anexos ] [ Histórico de alterações ]
```

## Atividades (novo)
Lista de sub-atividades próprias do item, criadas dentro dele:
- Campos: título, responsável, data prevista, situação (pendente / em execução / concluída), observação.
- Ações: adicionar, editar inline, marcar concluída (checkbox), excluir.
- Contador de concluídas/total no rótulo da aba (ex. "Atividades 2/5").
- Respeita a regra do projeto: edição inline, sem botão "Editar".
- Só habilitada quando o item já existe (em criação, aparece aviso "salve o item para adicionar atividades").

## Comentários e Anexos
Reaproveitam os componentes atuais (`ItemComentarios`, `ItemAnexos`), apenas movidos para dentro das abas. Audiência e parcelamento passam a ter também a aba de anexos onde já há suporte.

## Histórico de alterações (com justificativas)
Timeline lida de `auditoria_tarefas` (gravada pela trigger `audit_item_changes`), filtrada por `tipo_item` + id do item:
- Quem alterou (nome/e-mail), data/hora em BRT, ação e diff campo a campo (`campos_alterados`).
- Mudanças de situação destacadas ("Situação: Pendente → Protocolado") com a **justificativa/comentário** informado na troca exibido logo abaixo, dentro da mesma entrada — conforme escolhido, sem aba separada.

## Detalhes técnicos
- Nova tabela `public.subatividades_item`: `id`, `tipo_item` (tarefa|prazo|evento|audiencia|parcelamento), `item_id`, `titulo`, `responsavel_id`, `data_prevista`, `situacao`, `observacao`, `concluida_em`, `concluida_por`, `criado_por`, `created_at`, `updated_at`. Com GRANTs para `authenticated`/`service_role`, RLS (leitura/escrita para usuários autenticados, exclusão pelo autor/admin/coordenador) e índice em (`tipo_item`,`item_id`).
- Novos componentes em `src/components/comum/`: `ItemAtividades.tsx`, `ItemHistorico.tsx` e `ItemAbas.tsx` (o wrapper de abas com `Tabs` do shadcn).
- `ItemAbas` substitui os blocos soltos de `ItemComentarios`/`ItemAnexos` em `PrazoDialog.tsx`, `NovaTarefaDialog.tsx`, `EventoDialog.tsx`, `GerarParcelasDialog.tsx` e `EditarAudienciaDialog.tsx`.
- Sub-atividades incluídas em `CHAVES_ITENS_AGENDA` para invalidação de cache (`await invalidateQueries` antes de qualquer feedback de sucesso).
- Nenhuma alteração nas regras de situação, alertas ou e-mails existentes.
