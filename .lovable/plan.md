## Comparador com deduplicação prévia

Entendi a sua frustração e vi onde o relatório engana. Hoje, em `useComparadorAnalise` (`src/hooks/useDjenServidor.ts`), a chave de comparação é `coordenacao + id_djen`. Quando o PJE gera **7 `id_djen` diferentes para o mesmo processo/data** (caso do TST `0010334-57.2023.5.15.0095` ou TRT24 `0026098-91.2025.5.24.0021`), o Servidor pega 3-7 e o Browser pega 1 — e o comparador grita "faltou 6", quando na prática é **1 publicação lógica vs 1 publicação lógica = empate**.

A solução é fazer dedup lógica **antes** de comparar, como o `dedupePublicacoesDjen` (`src/utils/djenDedup.ts`) já faz na UI.

### O que muda em `useComparadorAnalise`

1. **Nova chave lógica** (igual à dedup visual):
   ```
   K = coord | dedup_processo_digits | dedup_data_ref (YYYY-MM-DD) | dedup_conteudo_key (ou hash_conteudo)
   ```
   Calculada para Servidor e Browser. Quando `dedup_processo_digits` está vazio (publicações TST sem processo, ex.: id 652316388), cai para `coord | id_djen` para não colapsar coisas distintas.

2. **Cluster por lado**: agrupar todas as linhas (servidor e browser) por essa chave K. Cada cluster vira **1 publicação lógica**, e guardamos a lista de `id_djen` que pertence ao cluster.

3. **Comparação por cluster K**, não mais por `id_djen` solto:
   - `em_ambos`: cluster existe nos dois lados (mesmo que os `id_djen` sejam diferentes).
   - `so_servidor` / `so_browser`: cluster existe num lado só.
   - `total_servidor` / `total_browser`: número de **clusters** (publicações lógicas), não de registros.

4. **Coluna nova `duplicadas_por_id_djen`**: para diagnóstico, exporto quantos `id_djen` cada cluster tem em cada lado. Assim você enxerga o caso "Servidor=7 ids / Browser=1 id" como **1 cluster em ambos** + nota "7×1 ids".

5. **Detalhe `so_servidor` / `so_browser`** continua listando cada `id_djen` real (com `provavel_causa`), mas só para clusters genuinamente exclusivos.

### Resultado esperado para 26/06

Aplicando a regra mentalmente ao CSV:

| Coordenação | Hoje (por id_djen) | Pós-dedup (por cluster) |
|---|---|---|
| Dr. Thomás | 6 so_serv / 2 so_brow | provavelmente 4 so_serv / 2 so_brow (3 ids do TRT24/0026098 viram 1) |
| Janaina Catunda | 6 so_serv / 0 | 4 so_serv / 0 (3 ids do TRT24 viram 1) |
| Vanessa Gomes TST | 1 so_serv / 0 | 1 so_serv / 0 (sem processo, mantém) |
| Santander Trabalhista | 8 so_serv / 0 | 2 so_serv / 0 (7 ids do TST/0010334 viram 1) |

Total de divergências cai de 23 para ~9, e o que sobrar é diferença **real** que vale investigar.

### Implementação

- Arquivo único: `src/hooks/useDjenServidor.ts`, função `useComparadorAnalise` (linhas 463–700+).
- Trocar `key(r)` (linha 644-649) por `clusterKey(r)` baseado em `dedup_*`.
- Manter `id_djen` apenas na listagem de detalhes/duplicadas.
- Atualizar o cabeçalho do CSV (`src/pages/DjenServidor.tsx`) para refletir "total = publicações lógicas (dedup)" e acrescentar coluna `ids_servidor`/`ids_browser` no cluster.
- Sem mudança no engine, no banco, nem nas execuções.

Confirma que sigo por aí?