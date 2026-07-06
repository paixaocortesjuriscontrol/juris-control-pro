#!/bin/bash
DATE="06/07/2026"
DATE_DASH="2026-07-06"
DATE_NODASH="06072026"
DATE_ISO="2026-07-06"

TRIBUNAL="2" # TRT2 as example
TR_PADDED="02"

URLS=(
  "https://diario.jt.jus.br/cadernos/Diario_J_${TR_PADDED}.pdf"
  "https://diario.jt.jus.br/cadernos/Diario_J_${TR_PADDED}_${DATE_DASH}.pdf"
  "https://diario.jt.jus.br/cadernos/Diario_J_${TR_PADDED}_${DATE_NODASH}.pdf"
  "https://dejt.jt.jus.br/dejt/f/n/downloadcaderno?da_publ=${DATE}&id_caderno=J&id_tribunal=${TRIBUNAL}"
  "https://dejt.jt.jus.br/dejt/f/n/downloadcaderno?dataPublicacao=${DATE}&caderno=J&tribunal=${TRIBUNAL}"
  "https://dejt.jt.jus.br/dejt/f/n/downloadcaderno?dataPublicacao=${DATE}&caderno=1&tribunal=${TRIBUNAL}"
  "https://dejt.jt.jus.br/dejt/f/n/downloadcaderno?id=123" # Dummy ID test
  "https://dejt.jt.jus.br/dejt/f/n/diariocon?evento=y&pesquisacaderno=J&dataIni=${DATE}&dataFim=${DATE}&tribunal=${TRIBUNAL}"
)

echo "Testing endpoints for date ${DATE}..."

for url in "${URLS[@]}"; do
  echo "---"
  echo "URL: $url"
  curl -I -s -L --max-time 10 "$url" | grep -E "HTTP/|Content-Type:|Location:"
done
