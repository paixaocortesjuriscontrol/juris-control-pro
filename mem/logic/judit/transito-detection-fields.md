---
name: Judit transito em julgado - campos de detecção
description: Código CNJ do movimento vem em step_type (não code); texto usa TRANSITADO EM JULGADO e a data real está no texto
type: feature
---
Na resposta da Judit, o código CNJ da movimentação vem em `step_type`
(ex.: `"848"`), NÃO em `code`. Sempre ler
`code ?? movement_code ?? step_type ?? type`.

Texto real das certidões: "TRANSITADO EM JULGADO EM 15.05.2026" — o regex
precisa cobrir TRANSITADO/TRANSITOU/TRANSITADA além de "TRÂNSITO EM JULGADO".

A data real do trânsito está escrita no próprio texto do movimento;
`step_date` é a data de captura (ex.: 02/07/2026 para trânsito de
15/05/2026). Priorizar a data extraída do texto (dd.mm.aaaa).

Caso de referência: 0191985-64.2001.5.12.0034 (Dossiê 07.02.008.0000370227/01).
