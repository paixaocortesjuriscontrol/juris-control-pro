# Padrão das planilhas da Distribuição TST (pedido da Dra. Lienne)

Vale só para as planilhas geradas na tela Distribuição TST, mas todas elas, sem exceção (inclusive a Carga Benner).

## Padrão em todas as células, inclusive os cabeçalhos
1. Fonte Calibri
2. Texto alinhado no meio (vertical)
3. Texto centralizado (horizontal)
4. Quebra de texto automática

As cores, os negritos, as larguras de coluna e a ordem das colunas que já existem não mudam.

## Planilhas que mudam
- Pendências e Dossiês
- Dossiês não localizados
- Duplicados e rejeitados da Certidão (importações)
- Relatório de Distribuição, Relatório Iara e Presidência-Admissibilidade
- Relatório por situação
- Carga Benner: Layout Carga TST, Conferência e Rejeições

## Detalhes técnicos
- Criar um helper único, `src/lib/estiloPlanilhaTst.ts`, para cada biblioteca:
  - **xlsx / xlsx-js-style:** usar `xlsx-js-style` nesses exports e aplicar `s.font.name = "Calibri"` e `alignment {horizontal: center, vertical: center, wrapText: true}` em todas as células, preservando o estilo que já existe.
  - **exceljs:** aplicar o mesmo em todas as células usadas.
  - **Modelo JSZip (Carga Benner):** reescrever `styles.xml` para trocar as fontes por Calibri e colocar o mesmo alinhamento em todos os `cellXfs`. Isso também resolve a regra pendente de centralizar todas as colunas.
- Fora da Distribuição TST, nenhuma planilha muda.
- Teste: gerar uma planilha de amostra e confirmar fonte, alinhamento e quebra em todas as células.
