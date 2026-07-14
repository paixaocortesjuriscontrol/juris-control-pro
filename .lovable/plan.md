# Unificar Detalhe do Processo com Painel de Controle

## O que muda no menu lateral do processo

Na seção **"Prazos & Eventos"** do sidebar (arquivo `ProcessoDetalhesCompletos.tsx`), remover **Intimações** e **Agenda**, e deixar exatamente as mesmas 5 opções do botão **Adicionar** do Painel de Controle:

- Tarefa
- Evento
- Prazo
- Audiência
- Parcelamento recorrente

A seção separada "Tarefas" some (Tarefa passa para dentro de "Prazos & Eventos"). Contadores continuam aparecendo em cada item.

## Formulários (criar/editar)

Em cada uma dessas 5 seções, ao clicar em **"Adicionar"** ou em um item existente para **editar**, abrir exatamente os mesmos formulários usados pelo Painel de Controle:

| Item | Formulário |
|---|---|
| Tarefa | `NovaTarefaDialog` (modo inline) |
| Evento | `EventoDialog` (modo inline) |
| Prazo | `PrazoDialog` (modo inline) |
| Audiência | `AudienciaFormSimplificado` |
| Parcelamento | `GerarParcelasDialog` (modo inline) |

Para evitar duplicação, vou **extrair** o `NovoItemPanel` que hoje mora dentro de `PainelControle.tsx` para um componente compartilhado (`src/components/shared/NovoItemPanel.tsx`) e passar a aceitar:

- `tipo` (tarefa/evento/prazo/audiencia/parcelamento)
- `itemParaEditar` (registro existente, opcional)
- `processoIdPreset` (para pré-vincular ao processo atual do detalhe)
- `publicacao` (opcional — publicação DJEN vinculada para exibir no card verde retrátil)

`PainelControle.tsx` passa a importar esse componente compartilhado (comportamento atual preservado).

## Publicação vinculada

Se o item aberto (novo ou existente) tiver publicação DJEN vinculada, o `PublicacaoVinculadaCollapsible` (card verde retrátil já existente) aparece no topo do formulário — mesmo comportamento adotado no Painel de Controle.

## Listagens dentro das seções

As telas de listagem de Audiências, Prazos e Tarefas continuam existindo (para exibir os itens do processo). O que muda:

- Botão **"+ Novo/Nova ..."** de cada uma passa a abrir o `NovoItemPanel` compartilhado com o `tipo` correspondente e `processoIdPreset` do processo atual.
- Clique em um item da lista abre o mesmo painel com `itemParaEditar`.
- Novas seções **Evento** e **Parcelamento** são criadas com listagens simples (usando `eventosAgenda` já carregado e filtrando por `tipo`), com o mesmo padrão.

## Arquivos afetados

- `src/components/shared/NovoItemPanel.tsx` — novo, extraído
- `src/pages/PainelControle.tsx` — passa a importar o compartilhado
- `src/components/processos/ProcessoDetalhesCompletos.tsx` — sidebar reestruturado + integração com `NovoItemPanel`
- (Sem mudanças em lógica de negócio ou banco.)

## Fora de escopo

- Não mexer em Andamentos, Documentos, Pedidos & Financeiro, Monitoramento, Distribuições ou Interação.
- Não alterar RLS, migrations ou provider de IA.
