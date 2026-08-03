---
name: Judit transito - sinais fortes/fracos e retentativa TST
description: Certidão 848/texto vence; remessa à origem e arquivamento definitivo só valem se processo arquivado; retentativa TST quando crawler só devolve TRT
type: feature
---
`buscar-judit` classifica sinais de trânsito em julgado:

- FORTES (prioridade absoluta): código CNJ `848` (vem em `step_type`) ou texto
  "trânsito/transitado/transitou em julgado". Data preferida = a escrita no texto.
- FRACOS (só quando NÃO há certidão E alguma instância está
  ARQUIVADO/BAIXADO/FINALIZADO): `remessa_trt`, `remessa_origem`
  ("remetidos os autos para órgão jurisdicional competente" / "recebidos os autos
  para prosseguir") e `arquivamento_definitivo` ("arquivados os autos
  definitivamente", "baixa definitiva"). Entre fracos usa-se o mais recente.

Reativação posterior (redistribuição, novo recurso, inclusão em pauta) continua
derrubando o trânsito.

Retentativa TST: quando `tribunal: "TST"` e nenhuma página devolvida é do TST
(a Judit responde do cache dela só com TRT), a função refaz o crawler com
`cache_ttl_in_days = 0` e agrega as páginas. `_judit_meta.retentativa_tst` e
`retentativa_tst_trouxe_tst` registram o resultado. Com `force_refresh` (ttl já 0)
a retentativa é dispensada.

Caso de referência: 0193900-65.2004.5.02.0053 — trânsito de 07/02/2025 existe só
no TST (a Judit nunca devolve essa instância); detectado via `remessa_origem`
em 13/02/2025.