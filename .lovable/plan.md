# Botão Judit na Distribuição TST — clique normal sempre busca a instância TST

## Contexto (confirmado por logs e banco)

A tela sempre pede `tribunal: "TST"`, mas cada processo trabalhista tem várias instâncias na Judit sob o mesmo CNJ (origem no TRT e revisão no TST). Os registros marcados com `problema_judit = true` têm relator/turma vindos da planilha e **`tipo_recurso` nulo**: em `judit_logs`, os cliques com sucesso da Kellen voltam com `_judit_meta.tribunal_selecionado = TRT2/TRT15/TRT3` e `instancia_tst: false`. `tipo_recurso` só é preenchido quando a instância selecionada é TST — logo, ao devolver o TRT, a função deixa o campo nulo **por regra**.

Hoje o clique normal se contenta com cache de qualquer instância (`cacheUsavel` e `juditAppCache` aceitam TRT) e a retentativa dirigida ao TST só roda com `force_refresh: true`. Comprovado no processo 1002068-91.2023.5.02.0203: clique normal → cache TRT2 vazio; "Forçar atualização" → relator, 6ª Turma e "Agravo de Instrumento" preenchidos.

## Decisão (resposta à pergunta)

O clique normal **passa a buscar a instância TST de verdade** — equivalente funcional ao "Forçar atualização", mas com uma economia: se o cache já for da instância TST e estiver dentro do TTL, responde do cache em ~1–2s. Ou seja:

```text
clique normal:
  cache TST válido?     → responde do cache (barato, instantâneo)
  cache só TRT / vazio? → consulta em tempo real (crawler) e seleciona instância TST
  crawler sem TST?      → 1 retentativa com ttl=0 (se houver orçamento de tempo)
  ainda sem TST?        → aviso fixo na tela + botão "Forçar atualização"
```

Justificativa de custo: nesta tela a consulta é única por processo (momento da distribuição). Aceitar cache TRT "barato" gera dado inútil e empurra a advogada para o duplo clique (normal + forçar), que já cobra duas consultas hoje. Pagar uma consulta em tempo real só quando não há cache TST sai igual ou mais barato — e o relatório `/consumo-judit` passa a medir isso com precisão.

## Correções

**A. Cache só encerra a consulta se for da instância TST.**
Em `buscar-judit`, quando `tribunalHint === "TST"`: `cacheUsavel` exige instância TST no registro em cache. Cache TRT é guardado como apoio (partes da origem, trânsito) e a função segue para o crawler.

**B. Retentativa TST no clique normal.**
Remover `forceRefresh` da guarda da retentativa (~linha 874); mantida a proteção de orçamento de tempo.

**C. Cache interno do app não devolve TRT.**
Em `juditAppCache`, descartar respostas anteriores cuja instância não é TST em vez de devolvê-las marcadas `_instancia_tst: false` (fim do congelamento de até 3 dias no dado incompleto).

**D. Orçamento de tempo e retry de rede.**
Elevar `POLL_TIMEOUT_MS`/`REQUEST_BUDGET_MS` para caber crawler + retentativa; no cliente, repetir uma vez automaticamente em erro de rede/timeout (`Failed to send a request to the Edge Function`) antes de mostrar erro.

**E. Aviso honesto quando a Judit não tem a instância TST.**
Se após crawler + retentativa não houver instância TST, alerta fixo no formulário: "A Judit ainda não indexou a instância TST deste processo — tipo de recurso e situação não podem ser preenchidos automaticamente", com "Forçar atualização" ao lado, e `problema_judit` marcado com essa informação.

**F. Log com autoria e duração.**
Trocar o insert manual de `judit_logs` (~linhas 710-723 do form) por `logJudit` de `src/lib/juditLog.ts` com `origem: "distribuicao-tst"`, registrando retentativa TST — mede no /consumo-judit quantos cliques ficam incompletos, quanto tempo levam e o custo por tipo.

## Detalhes técnicos

- `supabase/functions/buscar-judit/index.ts`: `cacheUsavel` condicionado a `isTstRd(cached)` quando `tribunalHint === "TST"`; remover exceção de `juditAppCache` (linhas 169-171); retirar `forceRefresh` da guarda da retentativa; ajustar `POLL_TIMEOUT_MS`/`REQUEST_BUDGET_MS`; expor `_judit_meta.tst_indisponivel`.
- `src/components/distribuicao-tst/DistribuicaoTstForm.tsx`: retry único em erro de rede; alerta persistente de instância TST indisponível; insert manual → `logJudit`.
- Sem alteração de schema.
- Custo: cliques em processos sem cache TST passam de `datalake` para `on_demand` (R$ 0,25/consulta na tabela de preços do relatório). Processos com cache TST válido continuam respondendo do cache. O duplo clique atual (normal + forçar = 2 cobranças) é eliminado.
