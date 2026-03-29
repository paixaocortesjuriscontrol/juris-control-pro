

# Análise dos Logs — Planilha TST

## Diagnóstico

Os logs mostram que o sistema está funcionando corretamente:

- **305/396 (77%)** processos encontrados no Input 2
- **53/396 (13%)** processos encontrados no Input 3
- **294/396 (74%)** processos efetivamente complementados (pelo menos 1 campo preenchido)

A diferença entre 305 matches e 294 complementados (11 processos) indica que esses 11 foram encontrados mas já tinham todos os campos preenchidos no Input 1 original.

Os **91 processos não encontrados** em nenhum input provavelmente são processos novos que simplesmente não existem nas outras planilhas. O Input 4 (Dossiês Ativos) com 5.897 linhas deve complementar parte desses no Passo 1.2.

## Problema real identificado

O campo **RELATOR** no Input 1 já possui uma coluna com esse nome (aparece nos headers). Portanto, `getFieldFromRow` lê o valor existente do Input 1, e se não estiver vazio, nunca tenta buscar nos outros inputs. O mesmo vale para DOSSIÊ, EQUIPE, RECLAMANTE e RECLAMADA — se o Input 1 já tiver essas colunas com valores (mesmo parciais), o sistema não sobrescreve.

## Melhorias propostas

### 1. Exibir diagnóstico visual na tela (não só console)
- Após processamento, mostrar card com:
  - Matches por input (Input 2: 305, Input 3: 53, Input 4: X)
  - Campos preenchidos por campo (Dossiê: X, Equipe: Y, etc.)
  - Amostras de processos não encontrados

### 2. Opção para forçar sobrescrita
- Checkbox "Sobrescrever campos já preenchidos no Input 1"
- Quando ativado, mesmo campos com valor no Input 1 serão atualizados com dados dos outros inputs

### 3. Melhorar log de diagnóstico do Passo 1.2 (Input 4)
- Adicionar logs equivalentes ao Passo 1.1 para o Input 4
- Mostrar quantos campos adicionais foram preenchidos

### 4. Remover IA do fluxo obrigatório
- Tornar o passo de IA opcional via checkbox (desativado por padrão)
- O cruzamento determinístico é suficiente na maioria dos casos

### Arquivos a modificar
- `src/pages/PlanilhaTst.tsx` — diagnóstico visual, checkbox de sobrescrita, logs do Passo 1.2, IA opcional

