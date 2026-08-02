# "Outra Matéria" não deve gerar pendências nem ir para a Carga Benner

## Situação atual (verificada no código)

- `src/utils/distribuicaoTstPendencias.ts` → `pendenciasMateriasAnalise()` monta a lista de matérias a cobrar a partir da string `materias_recurso_reclamante` / `materias_recurso_banco` **sem filtrar** "Outra Matéria". Resultado: quando "Outra Matéria" está selecionada junto com outra matéria, o sistema cobra Aparelhamento / Chance Turma / Chance Relator / Êxito para uma matéria que nem aparece na tabela de análise (a `MateriasAnaliseList` já a remove das linhas). São essas as pendências "fantasma" da tela.
- A exportação já ignora "Outra Matéria" nas colunas de análise: `src/utils/gerarPlanilhaBenner.ts` (linhas ~208-222) e `src/components/distribuicao-tst/CargaBennerFromDb.tsx` (`filtrarOutraMateria`, linhas ~560-568). O que falta é garantir que ela também não seja usada para decidir a emissão de linhas por parte nem apareça em nenhuma outra coluna/relatório.

## O que será feito

1. **Pendências**: em `pendenciasMateriasAnalise`, o tratamento de "Outra Matéria" (comparação sem acento/caixa, mesma função `isOutraMateria`) passa a depender de haver ou não outra matéria selecionada:
   - "Outra Matéria" + pelo menos uma matéria real → "Outra Matéria" é descartada e só as matérias reais são cobradas.
   - Somente "Outra Matéria" selecionada → ela **gera pendência** (Aparelhamento, Chance Turma, Chance Relator e Êxito), e a linha correspondente aparece na tabela de Análise por Matéria para ser preenchida.
2. **Carga Benner**: revisar os dois geradores para que "Outra Matéria" nunca chegue a nenhuma coluna, inclusive quando é a única selecionada — nesse caso a parte continua emitindo a linha, mas com as colunas de matérias vazias (nenhum texto "Outra Matéria").
3. Conferir os relatórios de pendências/Excel da Distribuição TST para que não listem "Outra Matéria" como item a preencher.

## Detalhe técnico

- Centralizar o helper `isOutraMateria` (hoje em `src/components/distribuicao-tst/MateriasMultiSelect.tsx`) num ponto reutilizável por `src/utils/*` sem criar dependência de componente → mover a normalização para um util e reexportar do componente, mantendo os imports existentes funcionando.
- Arquivos afetados: `src/utils/distribuicaoTstPendencias.ts`, `src/utils/gerarPlanilhaBenner.ts`, `src/components/distribuicao-tst/CargaBennerFromDb.tsx`, `src/components/distribuicao-tst/MateriasMultiSelect.tsx`.
- Sem mudança de banco de dados.
