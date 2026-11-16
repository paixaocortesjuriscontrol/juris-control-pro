#!/usr/bin/env bash
# Instala o serviço DJEN Cadernos na Hostinger, ao lado do proxy atual (não o altera).
# Uso (como root, na pasta onde está o caderno-server.js):
#   PROXY_TOKEN='<token da Hostinger no Pool de Proxies>' bash instalar-cadernos-hostinger.sh
set -euo pipefail
: "${PROXY_TOKEN:?Defina PROXY_TOKEN com o token da Hostinger VPS 1}"
DIR=/opt/djen-cadernos
DYN=/root/traefik-dynamic
mkdir -p "$DIR"
cp caderno-server.js "$DIR/caderno-server.js"
NODE=$(command -v node)

cat > /etc/systemd/system/djen-cadernos.service <<UNIT
[Unit]
Description=DJEN Cadernos (separado do proxy DJEN)
After=network.target
[Service]
Environment=PROXY_TOKEN=${PROXY_TOKEN}
Environment=PORT=8091
ExecStart=${NODE} --max-old-space-size=2048 ${DIR}/caderno-server.js
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now djen-cadernos
sleep 2
curl -fsS http://127.0.0.1:8091/caderno/health && echo

# Rota no Traefik: mesmo domínio, só o caminho /caderno vai para a porta 8091.
cp "$DYN/djen.yml" "$DYN/djen.yml.bak.$(date +%Y%m%d%H%M%S)"
python3 - "$DYN/djen.yml" "$DYN/djen-cadernos.yml" <<'PY'
import re, sys
src = open(sys.argv[1]).read()
out = src.replace("https://host.docker.internal:8443", "http://host.docker.internal:8091")
out = re.sub(r"Host\(`([^`]+)`\)", r"Host(`\1`) && PathPrefix(`/caderno`)", out, count=1)
# renomeia roteadores/serviços (chaves com 4 espaços de recuo) para não colidir
out = re.sub(r"^(    )([A-Za-z0-9_-]+):\s*$", r"\1\2-cadernos:", out, flags=re.M)
out = re.sub(r"(service:\s*)([A-Za-z0-9_-]+)", r"\1\2-cadernos", out)
out = re.sub(r"^\s*serversTransport:.*\n", "", out, flags=re.M)
open(sys.argv[2], "w").write(out)
PY
echo "---- $DYN/djen-cadernos.yml ----"; cat "$DYN/djen-cadernos.yml"
docker restart root-traefik-1 >/dev/null
sleep 5
echo "Teste externo:"
curl -sS https://djen-hostinger.juriscontrol.adv.br/caderno/health; echo
curl -sS https://djen-hostinger.juriscontrol.adv.br/health; echo
