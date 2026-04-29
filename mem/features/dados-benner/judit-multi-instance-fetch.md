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
