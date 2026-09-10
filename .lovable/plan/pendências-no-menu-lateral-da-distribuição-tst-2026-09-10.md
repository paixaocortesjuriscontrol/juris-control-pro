# Pendências no menu lateral da Distribuição TST

## Objetivo
Exibir as pendências na aba **Distribuição TST** da janela lateral direita aberta pela lista, quando existirem, reutilizando exatamente as regras da ficha completa.

## Alterações
- Adicionar na aba **Distribuição TST** da janela lateral direita um bloco chamado **Pendências**.
- Mostrar a quantidade total e listar os campos pendentes agrupados pela seção correspondente do formulário.
- Usar destaque vermelho para pendências reais e amarelo para avisos que não bloqueiam o envio, mantendo os dois grupos separados.
- Quando não houver pendências nem avisos, mostrar uma confirmação discreta de **Sem pendências ou avisos**.
- Calcular a lista ao abrir a janela com os dados já carregados do processo.
- Manter a ficha completa e o botão **Verificar Pendências** sem alterações.

## Detalhes técnicos
- Reutilizar `getPendenciasEAvisos`, separando itens com `aviso: true` no grupo amarelo.
- Carregar previamente as listas oficiais de matérias e pedidos por dossiê antes da primeira conferência completa.
- Preservar todas as regras atuais de situações impeditivas, matérias e Carga Benner.

## Verificação
- Conferir um processo com pendências, um sem pendências e um contendo somente aviso amarelo.
- Confirmar que a aba continua legível em telas menores e que o projeto compila sem erros.
