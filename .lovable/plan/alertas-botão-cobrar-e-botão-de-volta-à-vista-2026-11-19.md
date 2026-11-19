# Alertas: botão "Cobrar" e botão de volta à vista

## O que encontrei
- **O botão sumiu para o admin:** a central de notificações abre pelo botão vermelho **Alertas**, no topo do Painel de Controle. Esse botão fica junto dos filtros. Quando alguém esconde os filtros pelo ícone de ajustes, o botão Alertas some junto. Por isso parece que o menu desapareceu. Ele ainda pode ser aberto pelo selo "N não lidas" no menu lateral, mas esse selo só aparece quando há mensagens não lidas.
- **Cobrar a equipe:** o botão de cobrança (o mesmo "já cobrei" da agenda e da lista) não existe nos cartões de alerta. Hoje o cartão só tem "Marcar como lida" e a opção de abrir a atividade.

## O que vai mudar
1. **Alertas sempre visível:** o botão Alertas sai do bloco de filtros e fica sempre no topo do Painel, para todos os perfis, inclusive o admin.
2. **Cobrar no lembrete:**
   - Cartão de alerta ligado a uma atividade (audiência, prazo, tarefa ou evento): ganha o botão **Cobrar** ao lado de "Marcar como lida".
   - Lembrete com várias atividades: cada atividade da lista ganha o próprio botão.
   - A cobrança é a mesma já usada no Painel. O responsável recebe o aviso de cobrança, o símbolo aparece na atividade e um segundo clique no mesmo dia desfaz.
3. Versão no menu: v10.3.1.

## Fica de fora
- Lembretes sem atividade ligada, como resumos gerais, não ganham o botão, porque não há a quem cobrar.

## Detalhes técnicos
- `PainelControle.tsx`: mover o `Button` Alertas para fora do `mostrarFiltros && (...)`.
- `MinhasMensagensRecebidas.tsx`: renderizar `CobrancaBotao` com `itemId = refUnico` e para cada item de `itens_referencias`. O tipo do item vem do `tipo_alerta`/origem, com fallback para "tarefa". O estado vem de `useCobrancasItens` para os IDs visíveis.
- Sem mudança no banco: `item_cobrancas` e a fila de notificação já existem.
