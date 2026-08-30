#!/usr/bin/env bash
# DJEN Proxy — instalação/reset via systemd.
# Em seguida execute instalar-auto-renovacao-cert.sh para TLS + watchdog.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$HOME/djen-proxy}"
APP_NAME=djen-proxy
APP_PORT="${PORT:-8089}"
NODE_BIN="$(command -v node || true)"

die() { echo "ERRO: $*" >&2; exit 1; }
[ -n "$NODE_BIN" ] || die "Node.js não encontrado. Instale Node 18+."
NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 18+ é obrigatório."
command -v curl >/dev/null || die "curl não encontrado"

echo "==> [1/5] Preparando $APP_DIR..."
mkdir -p "$APP_DIR"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$SCRIPT_DIR/server.js" ] && cp "$SCRIPT_DIR/server.js" "$APP_DIR/server.js"
[ -f "$SCRIPT_DIR/package.json" ] && cp "$SCRIPT_DIR/package.json" "$APP_DIR/package.json"
[ -f "$APP_DIR/server.js" ] || die "server.js não encontrado em $APP_DIR"

echo "==> [2/5] Preservando credencial existente..."
PROXY_TOKEN="${PROXY_TOKEN:-}"
if [ -z "$PROXY_TOKEN" ] && [ -f "$APP_DIR/.env" ]; then
  PROXY_TOKEN="$(sed -n 's/^PROXY_TOKEN=//p' "$APP_DIR/.env" | head -1)"
fi
if [ -z "$PROXY_TOKEN" ] && [ -f "$APP_DIR/.token" ]; then PROXY_TOKEN="$(cat "$APP_DIR/.token")"; fi
[ -n "$PROXY_TOKEN" ] || die "PROXY_TOKEN não encontrado; informe-o sem criar outro diferente do pool"
printf 'PROXY_TOKEN=%s\nPORT=%s\n' "$PROXY_TOKEN" "$APP_PORT" > "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

echo "==> [3/5] Removendo processo PM2 legado..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop "$APP_NAME" >/dev/null 2>&1 || true
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
  pm2 save --force >/dev/null 2>&1 || true
fi

echo "==> [4/5] Instalando serviço systemd..."
sudo groupadd -f letsencrypt
sudo usermod -aG letsencrypt "$USER"
sudo tee /etc/systemd/system/djen-proxy.service >/dev/null <<UNIT
[Unit]
Description=DJEN Comunica Proxy
Wants=network-online.target
After=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$NODE_BIN $APP_DIR/server.js
Restart=always
RestartSec=5
SupplementaryGroups=letsencrypt
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable djen-proxy
sudo systemctl restart djen-proxy

echo "==> [5/5] Validando..."
for tentativa in 1 2 3 4 5; do
  if systemctl is-active --quiet djen-proxy && curl -fsS --max-time 10 "http://127.0.0.1:$APP_PORT/health" >/dev/null; then
    echo "DJEN Proxy ativo, saudável e habilitado no boot."
    echo "Agora execute instalar-auto-renovacao-cert.sh para configurar TLS e watchdog."
    exit 0
  fi
  [ "$tentativa" -lt 5 ] || break
  sleep 2
done
sudo systemctl status djen-proxy --no-pager -l || true
sudo journalctl -u djen-proxy -n 50 --no-pager || true
die "o proxy não respondeu após cinco tentativas"