# Corrigir etapas dos workflows e usar painel lateral

## O que será alterado

- Substituir a janela central de “Nova etapa” e “Editar etapa” pelo painel lateral direito sobreposto já usado no Painel de Controle.
- Manter a lista do workflow visível ao fundo, com fechamento pelo X, tecla Esc ou clique fora.
- Exibir os campos próprios do tipo selecionado, com nomes e organização equivalentes aos formulários normais:
  - **Prazo:** prazo em dias, unidade, data limite, prazo fatal, recorrência e observações.
  - **Tarefa:** data base, prazo, data e hora previstas, data e hora fatais, prioridade, local, recorrência e descrição.
  - **Evento:** início e término, horários, dia inteiro, modalidade, local, recorrência e observações.
  - **Audiência:** data, horários, modalidade, fórum, sala, local/link, vara/câmara/turma, comarca, partes, preposto, testemunhas e observações.
  - **Parcelamento:** primeira parcela, quantidade, valor, periodicidade, horário e descrição.
- Preservar os controles do workflow: ordem, condição, responsáveis, Kanban e atividades.

## Regras de datas

- Mostrar explicitamente **Data limite** para Prazo, sem o nome genérico “Data prevista”.
- Ao alterar prazo em dias ou unidade, recalcular a data limite com a mesma regra do cadastro normal.
- Usar a data de referência da publicação quando o fluxo vier da Análise DJEN; nos demais casos, usar o nascimento da etapa.
- Respeitar dias úteis/corridos e a suspensão processual já aplicada pelo sistema.
- Permitir definir datas relativas no modelo da etapa sem gravar datas fixas que envelhecem.
- O executor gravará cada campo na coluna correta do item criado, incluindo recorrência.

## Compatibilidade e validação

- Etapas antigas sem configurações adicionais continuarão usando os prazos genéricos já cadastrados.
- Conferir criação e edição dos cinco tipos, além do início pelo Painel de Controle, Análise DJEN e botão Play.
- Validar compilação e o comportamento visual do painel em desktop e tela estreita.
