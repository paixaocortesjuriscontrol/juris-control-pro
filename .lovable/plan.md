# Distribuição TST — voltar a abrir rápido com as matérias de 2025 carregadas

## O que está causando a demora

Verificado na base: a tabela de matérias por dossiê passou a ter **95.191 linhas** em **8.031 dossiês**.

A tela carrega essa lista inteira antes de conseguir calcular pendências (o cálculo de "Pronto sem pendência" e de "Revisar lista de matérias" é feito no navegador e precisa da lista completa em memória). Hoje essa carga é feita em páginas de 1.000 linhas, **uma depois da outra** — ou seja, 96 idas e voltas ao servidor em fila, e só no fim os cards aparecem. Antes da carga de 2025 eram poucas páginas, por isso ninguém percebia.

## Correção

1. Buscar a lista já **agrupada por dossiê** (uma linha por dossiê com as matérias juntas), em vez de uma linha por matéria: cai de 95 mil para 8 mil linhas.
2. Trazer essas linhas em **poucas páginas grandes e em paralelo**, em vez de 96 páginas em fila.
3. Guardar o resultado no navegador durante a sessão, para que trocar de filtro ou voltar à tela não refaça a carga.
4. Mostrar os cards de pendência com indicador de carregamento enquanto a lista chega, sem travar o resto da tela (a lista de processos continua aparecendo primeiro).

Nada muda nas regras de pendência, na Carga Benner nem nos dados: só a forma de buscar a lista.

## Detalhes técnicos

- Nova função no banco (migração), `SECURITY DEFINER`, `STABLE`, com `GRANT EXECUTE ... TO authenticated`:
  `get_pedidos_por_dossie_agrupados(p_offset int, p_limit int)` → `dossie text, pedidos text[], pedidos_normalizados text[]`, com `group by dossie order by dossie`.
  Índice de apoio: `create index if not exists idx_pedidos_por_dossie_dossie on public.pedidos_por_dossie (dossie)` (se ainda não existir).
- `src/utils/pedidosPorDossieCache.ts`:
  - `ensurePedidosPorDossie()` passa a chamar a RPC. Primeiro uma chamada com `p_offset 0 / p_limit 3000`; se vier cheia, dispara as páginas seguintes em `Promise.all` (limite calculado por `count` exato em `pedidos_por_dossie` distinto ou por páginas até vir incompleta, em blocos paralelos de 4).
  - Monta os mesmos `cache` (`dossie -> Set<normalizado>`) e `nomesCache` (`dossie -> Map<normalizado, grafia original>`) a partir dos arrays; assinaturas públicas (`pedidosDoDossieSync`, `nomeCanonicoDoDossieSync`, `isMateriaDoDossieSync`, `pedidosPorDossieCarregados`, `resetPedidosPorDossie`) ficam iguais — nenhum consumidor muda.
  - Persistência em `sessionStorage` (chave versionada, ex. `ppd-v1`) com gravação após a carga e leitura síncrona no primeiro `ensure`; em caso de erro de quota, apenas ignora.
- `useProntoSemPendenciaCount` e `useSemMateriaDossiePorResponsavel` seguem chamando `ensurePedidosPorDossie()` — sem alteração de lógica; ganham o tempo de carga reduzido.
- Verificação: medir no navegador o tempo até os cards preencherem (esperado poucos segundos em vez de dezenas) e conferir que "Pronto sem pendência" e "Revisar lista de matérias" mantêm exatamente as mesmas contagens de antes da mudança.
