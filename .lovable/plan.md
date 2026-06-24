## Objetivo

Incluir, no CSV exportado pelo **Comparador DJEN Servidor × Browser** (`/djen-servidor` → aba Comparador), uma seção detalhada listando, por coordenação, **cada publicação encontrada a mais por origem** (só Servidor vs só Browser) — não apenas os totais.

## O que muda

### 1. `src/hooks/useDjenServidor.ts` — `useComparadorAnalise`

- Selecionar campos adicionais nas duas queries (`publicacoes_djen_servidor` e `publicacoes_djen`):
  `processo_numero, tribunal, data_disponibilizacao, data_publicacao, id_djen` (alguns já vêm; faltam `data_publicacao` e garantir `processo_numero`/`tribunal`).
- Manter o `Map<key, row>` por origem (já existe via `sByKey`/`bByKey`).
- Após o cálculo dos buckets, construir uma nova lista `detalhes`:
  ```
  Array<{
    coordenacaoId, coordenacaoNome,
    tipo,                    // advogado / processo / palavra-chave / parte / sem_monitoramento
    origem: 'so_servidor' | 'so_browser',
    processo_numero, tribunal,
    data_publicacao,         // ou data_disponibilizacao se a primeira for nula
    id_djen,
  }>
  ```
  Geração: para cada chave em `sByKey` que não está em `bByKey` → `so_servidor`; e vice-versa. Coordenação/tipo vêm do `keyToBucket` já calculado.
- Adicionar `detalhes` ao tipo `ComparadorAnaliseRelatorio` e ao return.

### 2. `src/pages/DjenServidor.tsx` — `exportarRelatorioCsv`

- Acrescentar uma terceira seção ao CSV após "Totais":
  ```
  # Publicações exclusivas por origem (detalhamento)
  coordenacao,origem,tipo_pesquisa,tribunal,processo,data_publicacao,id_djen
  ...
  ```
  Ordenado por coordenação → origem → tribunal → processo.
- Escapar valores com `JSON.stringify` (mesmo padrão usado nas demais seções) para tolerar vírgulas/aspas.
- Nenhum impacto na UI (tabelas continuam mostrando apenas os agregados; o detalhe vai só para o CSV, como pedido).

### 3. Performance

- Limite atual de 20.000 linhas por query já cobre o intervalo típico. Como `detalhes` reaproveita os `Map`s existentes, o custo adicional é apenas montar o array (O(n)).
- Sem novas chamadas a Supabase.

## Fora de escopo

- Não alterar a lógica de dedup nem os totais existentes.
- Não mexer no pipeline servidor/browser (continua a tarefa separada já em andamento).
- Não criar UI nova; apenas o CSV ganha o detalhamento.