---
name: Índice dejt.html é apenas informativo
description: DEJT Pautas nunca deve bloquear download pelo índice dejt.html; validar pela data interna do PDF
type: constraint
---
Desde 09/2026 `https://diario.jt.jus.br/cadernos/dejt.html` lista somente os cadernos
Administrativos (`Diario_A_*.pdf`) e congelou a data ("Cadernos do dia 04/09/2026"),
enquanto os cadernos Judiciários (`Diario_J_*.pdf`) continuam sendo atualizados diariamente
no mesmo caminho fixo.

**Regra:** em `buscar-dejt-pautas`, o índice serve apenas para log. A validação da edição é
a data de disponibilização impressa dentro do PDF (`extractDataDisponibilizacaoYmd`) +
`Last-Modified`. Usar o índice como porteiro devolvia `sem-materias-na-edicao` para todos os
tribunais e zerava as pautas.

**Why:** o portal `dejt.jt.jus.br/dejt/f/n/diariocon` responde 403 (WAF Check Point) para
IPs de datacenter e não é alternativa viável; o repositório S3/CloudFront é a fonte que funciona.
