# Unificar painel "Em Agenda" com o visual simples da "Em Lista"

## Objetivo
No Painel de Controle, fazer a aba **Em Agenda** mostrar o mesmo card lateral simples que já existe na aba **Em Lista** (TarefaDetalhesPanel) — mas mantendo o comportamento atual da Em Agenda: **edição inline (sem popup)** e os **mesmos botões de ações** (Concluir/Reabrir, Cancelar, Processo, Editar, Descartar, Excluir).

## Arquivo a alterar
- `src/components/agenda/TarefaAgendaPanel.tsx`

## O que muda no modo visualização (não-edição)
Substituir os Collapsibles atuais (Publicação Vinculada, Detalhes do Processo, Parcelamento, Participantes, Detalhes da Tarefa, Comentários separados) pelo layout enxuto da Em Lista:

```text
┌─ Header ───────────────────────────────────────────┐
│ [TÍTULO (clicável p/ editar inline)]      [X]      │
│ [Badge prioridade] [Badge status]                  │
│ [Concluir] [Cancelar] [Processo] [Editar]          │
│ [Descartar] [Excluir]                              │
├────────────────────────────────────────────────────┤
│ 📅 Vencimento: dd/mm/aaaa   ⏱ status/atraso       │
│ 👤 Responsável: nome        💼 Processo: número    │
│                                                    │
│ Descrição                                          │
│ ...                                                │
│                                                    │
│ Observações                                        │
│ ...                                                │
│                                                    │
│ Comentários e Conversas                            │
│ [input + lista de comentários já existente]        │
└────────────────────────────────────────────────────┘
```

Removidos da visualização: blocos Publicação Vinculada, Detalhes do Processo (grid completo), Parcelamento, Participantes, Dados Projuris extensos, grid grande de "Detalhes da Tarefa". (A informação principal — vencimento/responsável/processo — fica visível em linha única, igual à Em Lista.)

## O que NÃO muda
- Modo de edição inline atual (`isEditing`) continua igual — clicar em **Editar** abre o formulário inline no mesmo painel, sem popup.
- Botões de ação do header (Concluir, Reabrir, Cancelar, Processo, Editar, Descartar, Excluir) e seus handlers permanecem idênticos.
- AlertDialogs de Descartar / Excluir permanecem.
- Hooks de dados (comentários, processo completo, etc.) permanecem; apenas o que aparece na tela é simplificado.
- Em Lista (`ListaAtividadesView` + `TarefaDetalhesPanel` + `PrazoDialog`) não é alterado.

## Detalhes técnicos
- Reaproveitar o cálculo de `isAtrasado` / `dias restantes` no padrão `TarefaDetalhesPanel`.
- Reutilizar a seção de comentários atual da Em Agenda (MentionInput + lista) mas inline (sem Collapsible), abaixo das observações.
- Manter título clicável para edição inline rápida (igual `TarefaDetalhesPanel`), gravando via update já existente.

## Fora de escopo
- Migrar Em Agenda para usar o componente `TarefaDetalhesPanel` diretamente (tipos `Prazo` x `ItemAgendaUnificado` são diferentes — replicar o layout é mais seguro).
- Mudanças no Em Lista.
