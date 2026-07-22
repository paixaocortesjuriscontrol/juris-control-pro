## Nova ferramenta: "Base PCA - TST - Distribuições"

Ferramenta administrativa no menu **Admin. TST** para aplicar uma TAG em massa a processos da base **Distribuição TST** (`dados_benner`) a partir de uma planilha Excel. Segue os padrões de UI/UX das telas `AdminTstOutroEscritorio` (upload + progresso + lotes) e `BulkTagAction` (seletor/criação de TAG com paleta de cores).

### Fluxo do usuário

1. Acessa `Admin. TST → Base PCA - TST - Distribuições`.
2. Faz upload da planilha `.xlsx`.
3. Sistema lê colunas **Dossiê** (col B) e **Processo** (col D), removendo aspa simples inicial (`'`) e normalizando espaços.
4. Sistema busca em lotes na `dados_benner` casando `dossie` OU `processo` (com dígitos-apenas para processo CNJ). Mostra barra de progresso "Buscando lote X/Y — encontrados: N".
5. Exibe resumo: total lido, encontrados, não encontrados, com botão de exportar planilha de não encontrados.
6. Advogado escolhe uma TAG (mesmo componente da tela Distribuição TST — lista com cores, criar nova com paleta, editar cor).
7. Clica **Aplicar TAG aos encontrados** → aplica em lotes de 200 via upsert em `dados_benner_processo_tags` com progresso "Aplicando lote X/Y".
8. Toast final: "TAG aplicada a N processos".

### Detalhes técnicos

- **Rota**: `/admin-tst/base-pca-distribuicoes` protegida por `AdminRoute`. Novo card em `src/pages/AdminTst.tsx` (ícone `Tags` do lucide).
- **Página**: `src/pages/AdminTstBasePcaDistribuicoes.tsx`.
- **Leitura da planilha**: `XLSX.utils.sheet_to_json` com `header: 1`, detecta cabeçalho por regex (`Dossiê`, `Processo`). Aceita a coluna com apóstrofo (`'0007600-63...`) — strip inicial `^'`. Para o processo, guarda também versão só-dígitos.
- **Busca em lotes** (500 chaves por request):
  - Query 1: `.from("dados_benner").select("id, dossie, processo").in("dossie", chunkDossies)`
  - Query 2: `.in("processo", chunkProcessos)` — com fallback tentando ambos formatados (com/sem máscara) já que `dados_benner.processo` é armazenado sem máscara em muitos casos (verificar pelo formato salvo — se necessário, comparar por dígitos-apenas via RPC leve `SELECT id FROM dados_benner WHERE regexp_replace(processo,'\D','','g') = ANY($1)`).
  - Deduplica IDs encontrados.
  - Atualiza progresso a cada lote.
- **Aplicação da TAG**: reutiliza a lógica de `BulkTagAction.applyTagToIds` (upsert em `dados_benner_processo_tags` com `onConflict: "dado_benner_id,tag_id"`, `ignoreDuplicates`), em chunks de 200. Progresso separado.
- **Seletor de TAG**: extrair um sub-componente `TagPickerInline` a partir do `Popover` de `BulkTagAction` (lista existente + criação com `ColorPalettePicker`), ou reutilizar `BulkTagAction` recebendo `selectedIds` já resolvidos. Preferência: extrair componente compartilhado `src/components/distribuicao-tst/TagPickerInline.tsx` usado por ambas as telas para não duplicar lógica.
- **Não encontrados**: exportar `.xlsx` com colunas Dossiê e Processo via `XLSX.writeFile`.
- **RPC opcional** (se busca por processo com máscara não casar): criar migration `find_dados_benner_by_dossie_or_processo(_dossies text[], _processos_digitos text[])` retornando `id`. Só se a primeira query direta não cobrir os casos.

### Layout (ASCII)

```text
[ Upload da planilha ]  arquivo.xlsx
[ Progresso: Buscando lote 3/12 — encontrados: 240 ]  [====------]

Resumo
  Total lido: 500    Encontrados: 460    Não encontrados: 40   [ Exportar não encontrados ]

Selecionar TAG a aplicar
  ( • ) Benner Completo    [criar nova TAG...]
  [ Aplicar TAG aos 460 encontrados ]

[ Progresso aplicação: 2/3 lotes ]
```

### Fora de escopo

- Não altera a tela `Distribuição TST`.
- Não cria/edita processos que não existirem na base (apenas relata como "não encontrados").
- Não importa nenhum outro campo da planilha (equipe, relator, etc.) — só é usada para busca por dossiê/processo.
