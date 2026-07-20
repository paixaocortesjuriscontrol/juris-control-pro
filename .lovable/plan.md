## Objetivo

Identificar em `dados_benner` todos os processos cujo `tipo_recurso_reclamante`, `tipo_recurso_banco` ou `tipo_recurso_terceiro` contenha algum valor que **não** faça parte da lista atual do seletor (`OPCOES_RECURSO` em `MultiTipoRecurso.tsx`) e apresentar isso em relatório com número do processo.

## Diagnóstico (já confirmado por consulta ao banco)

Rodei a consulta separando os valores por " + " e comparando com as 19 opções válidas. Existem muitos valores fora do padrão — divididos em três grupos:

1. **Placeholders/lixo**: `-`, `--`, `---`, `-----`, `_____` (mais de 150 ocorrências somadas).
2. **Variações de caixa/nomenclatura** que na verdade correspondem a opções válidas — apenas escritas diferentes:
   - `Agravo de Instrumento em Recurso de Revista` / `AGRAVO DE INSTRUMENTO EM RECURSO DE REVISTA` / `AIRO` → hoje não existe na lista (a lista só tem "Agravo de Instrumento" genérico).
   - `Recurso de Revista com Agravo` → também não está na lista.
   - `Recurso Ordinário Trabalhista` / `ROT` / `RORSUM` → lista só tem "Recurso Ordinário".
   - `RR`, `RECURSO DE REVISTA`, `RECURSO DE REVISTA (RR)` → equivalem a "Recurso de Revista".
   - `AR`, `AÇÃO RESCISÓRIA`, `Ação rescisória` → "Ação Rescisória".
   - `Rcl`, `RECLAMAÇÃO`, `Ag-Rcl` → "Reclamação".
   - `EMB` → "Embargos de Declaração" (provável).
3. **Códigos/tipos de ação que não são recursos** (vieram do Benner por engano): `ATORD`, `ATSUM`, `AÇÃO TRABALHISTA - RITO ORDINÁRIO/SUMARÍSSIMO`, `CUMPRSE`, `CUMSEN`, `CUMPRIMENTO DE SENTENÇA`, `PETCIV`, `MSCIV`, `HTE`, `ADESIVO`, `Agravo Regimental`.

## Entrega

Vou gerar um **arquivo Excel** (`.xlsx`) em `/mnt/documents/` com:

- **Aba 1 — Processos com tipo de recurso fora da lista**: uma linha por combinação (processo, dossiê, campo, valor). Colunas: Processo, Dossiê, Campo (reclamante / banco / terceiro), Valor fora da lista, Valor original completo do campo.
- **Aba 2 — Resumo por valor**: cada valor divergente e a quantidade de processos.

O relatório é somente leitura — não altera nenhum registro. Depois de gerado, você decide se quer:
- adicionar as opções faltantes na lista do seletor,
- ou fazer um "de-para" para normalizar os valores existentes no banco.

## Detalhes técnicos

- Fonte: tabela `dados_benner`, colunas `tipo_recurso_reclamante`, `tipo_recurso_banco`, `tipo_recurso_terceiro` (armazenam múltiplos valores separados por " + ").
- Lista válida: `OPCOES_RECURSO` em `src/components/distribuicao-tst/MultiTipoRecurso.tsx` (19 valores).
- Geração via `psql COPY` + montagem de xlsx com Python (`xlsxwriter`), salvando em `/mnt/documents/relatorio_tipo_recurso_fora_lista.xlsx`.
