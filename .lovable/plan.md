# Observação do advogado no processo e na Análise DJEN

## O que será feito

- Exibir o campo **Observação do advogado** na visão geral de Processos e Casos, junto à descrição do processo, para consulta e edição.
- Reutilizar o campo já existente `processos.observacao_advogado`; não haverá migração nem mudança de permissões.
- Na Análise DJEN, para publicações com processo cadastrado, adicionar a ação **Observação**, que abre um painel lateral direito com o texto atual.
- Permitir inserir, alterar ou limpar a observação nesse painel e mostrar confirmação somente depois que o banco confirmar a gravação.
- Aplicar a mesma ação nas duas visões da Análise DJEN que exibem processos cadastrados.

## Garantias

- O painel da Análise DJEN atualizará somente a observação do processo, sem alterar publicação, leitura, movimentações, partes ou demais dados.
- Cancelar ou fechar o painel não salvará alterações.
- Após salvar, os dados do processo serão atualizados nas telas já abertas.

## Verificação

- Adicionar teste da regra que monta a atualização somente com o campo da observação.
- Rodar os testes relacionados e conferir a compilação do projeto.
