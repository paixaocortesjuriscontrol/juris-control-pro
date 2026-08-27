# Carga Benner — nova coluna final "Sem chance de êxito"

## Objetivo
Todas as planilhas geradas na Carga Benner (Distribuição TST) passam a ter uma coluna adicional no final, chamada **Sem chance de êxito**, alimentada pela análise por matéria preenchida na tela (coluna Êxito).

## Regra de preenchimento
- Para cada processo, lista (separada por vírgula, sem espaço) das matérias cuja seleção de **Êxito = NÃO**, considerando as análises do Reclamante e do Banco.
- Matérias duplicadas são unificadas; "Outra Matéria" e matérias fora da lista oficial continuam fora da exportação.
- Se nenhuma matéria tiver Êxito = NÃO, a célula fica vazia.
- A coluna existente de Êxito (matérias com SIM) permanece intacta.

## Onde aparece
- Planilha Completa (A–AH → nova última coluna AI)
- Até Recurso (A–Q) e Até Análise quarteirizado (A–G): a nova coluna entra como última coluna dessas planilhas
- Planilha de Conferência (que insere Processo depois do Dossiê): nova coluna no final
- Planilha de Rejeições: nova coluna no final

## Detalhes técnicos
- `src/utils/gerarPlanilhaBenner.ts`:
  - em `getValuesFromDado`, calcular `semExito` com o mesmo `joinUnique`/normalização já usados, filtrando `chance_exito` normalizado igual a `NAO`; adicionar ao final do array de valores.
  - garantir letra de coluna suficiente em `colLetters` (já vai até `AI`; estender se necessário) e recalcular `dimension`/`lastColLetter`.
  - nos modos truncados (`aq`, `ag`, `conferencia`), anexar o valor da nova coluna após o recorte, escrevendo o cabeçalho "Sem chance de êxito" na linha de cabeçalho correspondente (mesmo estilo centralizado já criado no template).
  - em `gerarPlanilhaRejeicoes`, incluir a chave "Sem chance de êxito" nas linhas exportadas.
- Sem mudanças de schema nem de UI; apenas geração de planilha.
