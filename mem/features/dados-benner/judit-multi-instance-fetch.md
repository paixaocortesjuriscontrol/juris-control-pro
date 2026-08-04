---
name: Judit Multi-Instance Fetch
description: buscar-judit força crawler async sem hint para obter TST+TRT juntos; normaliza tribunal_acronym por courts/classe; trânsito desconsiderado se reativado
type: feature
---
Sem `tribunal_hint`, descartar cache da Judit (1 instância) e forçar
crawler async para devolver todas as instâncias (TRT+TST). Caso real:
0001695-95.2013.5.01.0481 com RR no TST distribuído em 10/12/2025
ficava preso aos dados antigos da TRT1.

Tribunal: detectar TST por `courts[].name` ("TST" ou "Gabinete do
Ministro/Ministra") OU `classifications[].name` ∈ {RR, AIRR, AG-AIRR,
ARR, ED-RR, ED-AIRR}, mesmo quando `tribunal_acronym` veio "TRT1".
`temIndicioTST()` não serve (descarta cedo quando acronym ≠ TST).

Trânsito em julgado: se há step de trânsito mas EXISTE step posterior
de reativação (DISTRIBUÍDO POR SORTEIO, CERTIDÃO DE (RE)DISTRIBUIÇÃO,
novo recurso, inclusão em pauta), processo volta a "Ativo" e
processo_baixado="N".

`recorrente` deriva de `tipo_recurso_*` confirmado pela Judit:
só banco→"Banco"; só reclamante→"Reclamante"; ambos→"Ambos"; nenhum→
fallback poloAtivo. Mais preciso que polo ativo da capa.

Performance: `buscar-judit` é cache-first. Quando o lookup `GET
/lawsuits/:cnj` devolve `parties`/`steps` válidos (e bate com `tribunal_hint`
TST quando aplicável), responde imediato com `_judit_meta.fonte =
"cache_instant"` e dispara o crawler async em background (fire-and-forget)
só para atualizar o cache da Judit para a próxima consulta. TTL padrão é 3
dias. `force_refresh: true` ou `com_anexos: true` sempre forçam o caminho
síncrono com TTL=0. Frontend (`DistribuicaoTstForm`, `ProcessoVisaoGeralForm`,
`DistribuicaoTstDetail`) só envia `force_refresh: true` quando o usuário
clica explicitamente em "Forçar atualização" — chamadas normais aproveitam
o cache e retornam em <2s.

Latência (ago/2026): o clique normal NUNCA espera crawler longo.
`POLL_TIMEOUT_MS`=25s, orçamento total 30s, e a "retentativa TST"
(recrawl ttl=0) só roda com `force_refresh: true`. O cache da Judit e o
app-cache (`judit_logs`) são aceitos mesmo quando a instância é TRT e a tela
pediu TST — a resposta traz `_judit_meta.instancia_tst=false` e a UI avisa
para usar "Forçar atualização" se precisar do TST. Antes disso cada clique
gastava 62s (1 crawler) ou 124s (crawler + retentativa).
