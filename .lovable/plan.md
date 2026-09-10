# Pendências no menu lateral da Distribuição TST

## Objetivo
Exibir no menu lateral direito da ficha da Distribuição TST as pendências do processo, quando existirem, reutilizando exatamente as regras já usadas pelo botão **Verificar Pendências**.

## Alterações
- Adicionar abaixo do botão **Verificar Pendências** um bloco fixo chamado **Pendências**.
- Mostrar a quantidade total e listar os campos pendentes agrupados pela seção correspondente do formulário.
- Usar destaque vermelho para pendências reais; quando não houver nenhuma, mostrar uma confirmação discreta de **Sem pendências**.
- Não misturar os avisos amarelos que não bloqueiam o envio com a lista de pendências reais.
- Atualizar a lista ao abrir o processo, depois de salvar e depois de usar **Verificar Pendências**, mantendo os dados exibidos sincronizados com a ficha.
- Manter o comportamento atual do botão, incluindo o destaque e a rolagem até os campos pendentes.

## Detalhes técnicos
- Centralizar a montagem dos dados usados na conferência para evitar diferença entre o botão e o novo bloco lateral.
- Reutilizar `getPendenciasEAvisos`, filtrando itens com `aviso: true` da lista vermelha.
- Carregar previamente as listas oficiais de matérias e pedidos por dossiê antes da primeira conferência completa.
- Preservar todas as regras atuais de situações impeditivas, matérias e Carga Benner.

## Verificação
- Conferir um processo com pendências, um sem pendências e um contendo somente aviso amarelo.
- Validar atualização após salvar e após clicar em **Verificar Pendências**.
- Confirmar que o menu continua legível em telas menores e que o projeto compila sem erros.
