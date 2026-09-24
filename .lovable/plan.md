# Corrigir filtros da Inteligência Jurídica

## Objetivo
Fazer os filtros refletirem todas as fontes realmente usadas pelo módulo, sem misturar indicadores da Distribuição TST com os de Processos e Casos.

## Alterações
- Alimentar **Equipe** exclusivamente pelos valores existentes nas fichas da tela **Distribuição TST** (`dados_benner`), em vez do cadastro `equipes_tst`, que atualmente contém apenas “Núcleo Crítico”.
- Alimentar **Tribunal** pela união dos tribunais da Distribuição TST e de **Processos e Casos**, eliminando vazios e duplicidades.
- Manter os indicadores claramente separados:
  - cartões, evolução, turma, relator, equipe, ofensores e oportunidades: Distribuição TST;
  - bloco **Processos e Casos** e indicadores financeiros: processos cadastrados nessa tela;
  - previsão de êxito: histórico combinado das duas fontes.
- Exibir no filtro a origem quando necessário, para evitar que um tribunal exclusivo de Processos e Casos pareça produzir resultados nos quadros TST.

## Técnica
- Criar uma função segura de leitura para devolver listas distintas de equipes e tribunais das duas bases, evitando o limite de 1.000 registros do navegador.
- Atualizar a tela para consumir essa função e manter os filtros atuais aplicados aos respectivos blocos.
- Validar as opções retornadas e a ausência de erros na tela.
