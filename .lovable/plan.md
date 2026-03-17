

## Diagnóstico

O problema está na forma como as datas são lidas da planilha. O código atual faz duas coisas que causam erro:

1. **Prioriza `cell.w` (texto formatado) em vez de `cell.v` (valor real)**: Com `cellDates: true`, o XLSX converte a célula de data num objeto `Date` em `cell.v`. Mas a função `getSheetRows` (linha 85) faz `cell?.w ?? cell?.v`, ou seja, pega o texto formatado primeiro. Esse texto depende do locale do Excel e pode vir como "2/1/2019" (m/d/yyyy americano) em vez de "01/02/2019" (dd/mm/yyyy brasileiro), causando inversão dia/mês ou datas completamente erradas.

2. **Busca dinâmica de colunas por nome de cabeçalho**: `findColumn(headers, ["fatal"])` pode falhar se o cabeçalho não contiver exatamente a palavra "fatal".

Como o layout é fixo, a solução é simples e direta.

## Plano

### 1. Reescrever `getSheetRows` para tratar datas corretamente

Na função `getSheetRows`, para cada célula, verificar se é uma data (`cell.t === 'd'` ou `cell.v instanceof Date`). Se for, retornar o objeto `Date` diretamente em vez do texto formatado. Para outras células, manter o comportamento atual (`cell.w ?? cell.v`).

### 2. Hardcodar a coluna B (índice 1) como data fatal

Já que o layout é fixo, usar `const colFatal = 1` (coluna B) diretamente, em vez de depender do `findColumn`. Manter os demais `findColumn` para as outras colunas que são texto simples.

### 3. Simplificar `parseExcelDate`

A função já lida com `Date`, `number` e `string`. Mas com a mudança acima, ela receberá um `Date` real na maioria dos casos, evitando completamente a ambiguidade de formato de texto.

### 4. Limpar dados antigos e re-importar

Executar `DELETE FROM prazos_tst` para limpar os dados importados incorretamente, permitindo nova importação com a lógica corrigida.

### Alterações em arquivo

- **`src/components/tst-prazos/TstImportDialog.tsx`**: Modificar `getSheetRows` para retornar `Date` objects para células de data; hardcodar `colFatal = 1`; deletar dados errados via migration.

