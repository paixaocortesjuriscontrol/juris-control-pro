#!/usr/bin/env bash
# DJEN Proxy — instalação/reset para systemd (idêntica ao modelo usado nas vm01/vm02/vm03/vm09)
# Uso: curl -fsSL https://juris-control-pro.lovable.app/scripts/instalar-djen-proxy-systemd.sh | bash
# Ou, localmente: bash instalar-djen-proxy-systemd.sh
set -euo pipefail

APP_DIR="$HOME/djen-proxy"
APP_NAME="djen-proxy"
APP_PORT="${PORT:-8089}"
NODE_BIN="$(command -v node || echo '/usr/bin/node')"

echo "==> [1/5] Verificando Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js não encontrado. Instale com: sudo apt update && sudo apt install -y nodejs npm"
  exit 1
fi
NODE_MAJOR=$(node -v | sed -E 's/^v([0-9]+).*/\1/')
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js $NODE_MAJOR encontrado. Recomendado >= 18."
  exit 1
fi
echo "    Node $(node -v) OK"

echo "==> [2/5] Preparando diretório $APP_DIR..."
mkdir -p "$APP_DIR"
# Se o script foi baixado junto com server.js, copia; senão, assume que já existe.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/server.js" ]; then
  cp "$SCRIPT_DIR/server.js" "$APP_DIR/server.js"
fi
if [ -f "$SCRIPT_DIR/package.json" ]; then
  cp "$SCRIPT_DIR/package.json" "$APP_DIR/package.json"
fi

echo "==> [3/5] Configurando variáveis de ambiente..."
# Se PROXY_TOKEN não veio do ambiente, tenta ler .env ou .token existente
if [ -z "${PROXY_TOKEN:-}" ]; then
  if [ -f "$APP_DIR/.env" ]; then
    PROXY_TOKEN="$(grep -E '^PROXY_TOKEN=' "$APP_DIR/.env" | head -1 | cut -d= -f2-)"
  fi
  if [ -z "$PROXY_TOKEN" ] && [ -f "$APP_DIR/.token" ]; then
    PROXY_TOKEN="$(cat "$APP_DIR/.token")"
  fi
fi
if [ -z "${PROXY_TOKEN:-}" ]; then
  echo "ERRO: PROXY_TOKEN não definido. Passe como env ou salve em $APP_DIR/.env"
  exit 1
fi

printf 'PROXY_TOKEN=%s\nPORT=%s\n' "$PROXY_TOKEN" "$APP_PORT" > "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

echo "==> [4/5] Instalando serviço systemd djen-proxy.service..."
sudo tee /etc/systemd/system/djen-proxy.service >/dev/null <<UNIT
[Unit]
Description=DJEN Comunica Proxy
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$NODE_BIN $APP_DIR/server.js
Restart=always
RestartSec=3
SupplementaryGroups=letsencrypt

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable djen-proxy

# Se houver processo antigo do PM2, tenta parar sem erro
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop "$APP_NAME" 2>/dev/null || true
  pm2 delete "$APP_NAME" 2>/dev/null || true
  pm2 save --force 2>/dev/null || true
fi

sudo systemctl restart djen-proxy

echo "==> [5/5] Validando..."
sleep 2
STATUS=$(systemctl is-active djen-proxy)
HEALTH=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/health" || true)

echo "    Serviço: $STATUS"
echo "    Health: $HEALTH"

if [ "$STATUS" = "active" ] && [ "$HEALTH" = "200" ]; then
  echo "================================================================"
  echo "DJEN Proxy ativo em http://127.0.0.1:$APP_PORT"
  echo "Health check: curl http://127.0.0.1:$APP_PORT/health"
  echo "================================================================"
else
  echo "================================================================"
  echo "ALGO FALHOU. Verifique:"
  echo "  sudo systemctl status djen-proxy --no-pager"
  echo "  sudo journalctl -u djen-proxy -n 50 --no-pager"
  echo "================================================================"
  exit 1
fi
