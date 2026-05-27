## Objetivo

Reduzir o tempo da pesquisa "DJEN Termos Paralela" agrupando termos do mesmo tipo num único request por tribunal/dia, usando a sintaxe `OR` no `palavraChave` (até 20 termos por chamada). O TST mantém o comportamento atual (1 termo por chamada), pois já é rápido assim.

## Escopo

Só `src/hooks/useDjenTermosParalelaEngine.ts`. Sem mudanças de UI, schema ou edge functions.

## Comportamento por tipo

| Tipo do monitoramento | TST | Demais tribunais |
|---|---|---|
| `processo` | 1 chamada por termo (`numeroProcesso`) | Agrupa até 20 números num `palavraChave: "N1 OR N2 OR ..."` |
| `palavra-chave` / `nome` | 1 chamada por termo | Agrupa até 20 termos num `palavraChave: "(T1) OR (T2) OR ..."` |
| `advogado` | 1 chamada por termo (`nomeAdvogado`+`oab`) | Sem alteração — API exige campo dedicado por advogado |
| `parte` | 1 chamada por variação (`nomeParte`) | Sem alteração — API exige campo dedicado por parte |

Justificativa: a API PJE Comunica não aceita lista em `nomeAdvogado`/`nomeParte`. Só `palavraChave` (e por extensão `numeroProcesso` reescrito como query) admite OR.

## Como o agrupamento funciona

No loop `processarTribunal` (linhas ~970-1082), antes de iterar `mon × dia`:

1. Separar `monsParaEsseTrib` em dois conjuntos:
   - **agrupáveis**: tipos `processo`, `palavra-chave`, `nome` quando `tribunal !== 'TST'`.
   - **individuais**: tudo o mais (incluindo todos os tipos no TST).
2. Para cada `diaYmd`:
   - Quebrar os agrupáveis por subtipo (`processo` separado de `palavra-chave`/`nome`) em lotes de até 20.
   - Para cada lote, montar a query OR e fazer 1 chamada via novo helper `processarGrupoEmTribunal(...)`. Filtrar localmente cada publicação contra o termo de origem (usando os filtros já existentes: `validarParteSecaoPartes`, `validarPalavrasChave`, comparação de `numeroProcesso` etc.) e atribuir cada match ao `mon` correto.
   - Para os individuais, manter o caminho atual `processarTermoEmTribunal(mon, diaYmd, ...)`.
3. Contadores de progresso (`processed`, `total`, `acumNovas/Dup/Desc`) continuam sendo atualizados por termo. O `total` por track passa a contar termos (não chamadas), então a barra continua coerente; o `processed` é incrementado por termo após o lote ser processado.

## Novo helper `processarGrupoEmTribunal`

Mesma assinatura/retorno de `processarTermoEmTribunal`, mas recebe um array `mons: Monitoramento[]` e:

- Monta `palavraChave`:
  - `processo`: `numeros.map(n => n.replace(/\D/g,'')).join(' OR ')`.
  - `palavra-chave`/`nome`: para cada termo, se contém `+`, pegar o maior fragmento via `encurtarParaApi` (mesma lógica atual); juntar como `(t1) OR (t2) OR ...`.
- Usa `tipo: 'palavra-chave'` no request (mesmo para grupos de processo) — o filtro local garante a correção.
- Reaproveita `buscarPjeComunicaPaginado` com os mesmos parâmetros (`pageSize: 50`, `continueUntilEmpty: true`, mesmo `forceVia`, etc.).
- Após receber `resp.items`, distribuir cada publicação entre os `mons` do lote, validando com as funções existentes:
  - Para grupo `processo`: comparar `numeroProcesso` (só dígitos) com cada `mon.termo_busca`.
  - Para grupo `palavra-chave`/`nome`: rodar `validarPalavrasChave` / `validarExclusoes` / `validarConcomitancia` de cada `mon` contra o item, escolhendo o primeiro `mon` cujo termo casa.
- Itens sem nenhum match são descartados (contam em `descartadas` do tribunal, sem vincular a `mon`).
- Sem retry automático (já desativado para `processo`; para `palavra-chave` em grupo o retry deixa de fazer sentido — fica desligado também).

## Detalhamento técnico

- Configuração: adicionar `CONFIG.group_search_size = 20` (constante) com possibilidade futura de tornar configurável.
- Detecção do TST: comparação `tribunal === 'TST'` (já é o literal usado em `TODOS_TRT`).
- O `executarBusca` atual permanece para o caminho individual; o helper de grupo chama `buscarPjeComunicaPaginado` diretamente.
- `registrarViaTrack` continua sendo chamado por chamada (1 por grupo, 1 por termo individual).
- O cooldown PJE por VPS (`getPjeComunicaGlobalCooldownRemainingMs`) é respeitado também antes de cada chamada de grupo.
- Dedup por `id_djen` continua igual.

## Impacto esperado

- Coordenações com muitos termos `palavra-chave`/`processo` (ex.: Dr. Thomás com 173 processos × 26 tribunais × N dias) caem de ~4.500 chamadas para ~225 chamadas nos tribunais não-TST (90%+ redução), mantendo o TST rápido.

## Validação

- Build automático.
- Conferir nos logs do console que para tribunais não-TST aparecem mensagens do tipo `Grupo X/Y (20 termos)` e que o número de chamadas por dia caiu.
- Conferir que para TST as chamadas continuam 1-por-termo.
- Conferir um termo conhecido (ex.: processo CNJ específico do Bradesco) para garantir que ele ainda casa e é gravado no `mon` correto.
