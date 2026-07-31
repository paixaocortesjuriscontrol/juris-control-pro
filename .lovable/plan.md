# Remover a numeração ("1.", "2.") das matérias na Carga Benner

## Onde está o problema (verificado)

A numeração **não** é gerada pela planilha. Ela está gravada no próprio dado: as matérias em `dados_benner.materias_analise_reclamante` / `materias_analise_banco` já vêm salvas como `"1. Nulidade do aviso prévio"`, `"2. Incidente de desconsideração..."` etc. Confirmei isso consultando a base — vários registros têm o prefixo numérico dentro do campo `materia`.

Origem: o prompt da IA (`analisar-tst-ia`) pede a lista no formato `1. Matéria A; 2. Matéria B`, e o parse quebra por `;` mantendo o número no texto. Quando a planilha junta as matérias por linha (`joinUniqueMat`), os números aparecem exatamente como na sua imagem (colunas AB..AH).

## Correção

1. **Prompt/parse da IA**: instruir a IA a devolver as matérias sem numeração e, no parse, remover qualquer prefixo do tipo `1.`, `1)`, `1 -`, `•` antes de gravar.
2. **Limpeza na leitura/exportação**: aplicar uma função de sanitização (`limparPrefixoNumeracao`) nas matérias ao montar as colunas AB..AH tanto em `CargaBennerFromDb.tsx` (Distribuição TST → Gerar Carga Benner) quanto em `gerarPlanilhaBenner.ts` (Dados Benner) e no PDF (`gerarPdfBenner.ts`), garantindo saída limpa mesmo para dados antigos.
3. **UI**: aplicar a mesma limpeza na exibição das matérias (`MateriasAnaliseList.tsx`), para tela e planilha ficarem idênticas.
4. **Dados existentes (opcional, recomendado)**: migração SQL que remove o prefixo numérico do campo `materia` nos JSONs já gravados em `dados_benner`, para não depender apenas da limpeza em tempo de exportação.

## Detalhes técnicos

- Regex de limpeza: `^\s*(\d{1,2}\s*[\.\)\-–]\s*|[•\-]\s*)` aplicado uma vez, preservando o resto do texto (inclusive maiúsculas/minúsculas e parênteses).
- Nada muda na ordem, deduplicação ou nas regras de filtro por chance/aparelhamento; apenas o texto de cada matéria.
- A junção continua por `\n` dentro da célula, respeitando o layout atual do template.
