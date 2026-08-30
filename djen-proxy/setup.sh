#!/usr/bin/env bash
# DJEN Comunica Proxy — instalador legado PM2.
# DEPRECADO: use instalar-djen-proxy-systemd.sh e depois
# instalar-auto-renovacao-cert.sh. Este arquivo permanece apenas para VMs antigas.
# Uso:
#   bash setup.sh                  # primeira vez (gera token novo)
#   PROXY_TOKEN=xxx bash setup.sh  # reaproveita token já existente
#
# O script:
#  - garante Node.js 18+
#  - garante PM2
#  - copia server.js para ~/djen-proxy
#  - sobe via PM2 na porta 8089 (loopback)
#  - configura PM2 para subir no boot
#
# Depois disso, exponha via Nginx no subpath /djen-proxy/ (veja README.md).

set -euo pipefail

APP_DIR="$HOME/djen-proxy"
APP_NAME="djen-proxy"
APP_PORT="${PORT:-8089}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> [1/6] Verificando Node.js..."
echo "AVISO: fluxo PM2 legado; para instalações novas, use o instalador systemd."
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js não encontrado. Instale antes de rodar este script (sudo apt install -y nodejs npm) ou use o Node já provisionado da Hostinger."
  exit 1
fi
NODE_MAJOR=$(node -v | sed -E 's/^v([0-9]+).*/\1/')
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js $NODE_MAJOR encontrado. Recomendado >= 18."
  exit 1
fi
echo "    Node $(node -v) OK"

echo "==> [2/6] Verificando PM2..."
if ! command -v pm2 >/dev/null 2>&1; then
  echo "    Instalando PM2 globalmente (npm i -g pm2)..."
  npm install -g pm2
fi
echo "    PM2 $(pm2 -v) OK"

echo "==> [3/6] Preparando $APP_DIR ..."
mkdir -p "$APP_DIR"
cp "$SCRIPT_DIR/server.js"     "$APP_DIR/server.js"
cp "$SCRIPT_DIR/package.json"  "$APP_DIR/package.json"

echo "==> [4/6] Resolvendo PROXY_TOKEN..."
TOKEN_FILE="$APP_DIR/.token"
if [ -n "${PROXY_TOKEN:-}" ]; then
  echo "    Usando PROXY_TOKEN do ambiente."
  echo "$PROXY_TOKEN" > "$TOKEN_FILE"
elif [ -f "$TOKEN_FILE" ]; then
  PROXY_TOKEN="$(cat "$TOKEN_FILE")"
  echo "    Reaproveitando token de $TOKEN_FILE."
else
  echo "    Gerando token novo..."
  PROXY_TOKEN="$(openssl rand -hex 32)"
  echo "$PROXY_TOKEN" > "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
fi

echo "==> [5/6] Subindo via PM2 na porta $APP_PORT ..."
# se já existe, reinicia com env atualizado; senão, cria
if pm2 list | grep -q "$APP_NAME"; then
  PROXY_TOKEN="$PROXY_TOKEN" PORT="$APP_PORT" pm2 restart "$APP_NAME" --update-env
else
  cd "$APP_DIR"
  PROXY_TOKEN="$PROXY_TOKEN" PORT="$APP_PORT" pm2 start server.js --name "$APP_NAME"
fi
pm2 save

echo "==> [6/6] Configurando boot do PM2 (rode o comando que ele imprimir, se houver)..."
pm2 startup || true

echo
echo "================================================================"
echo "DJEN Proxy ativo em http://127.0.0.1:$APP_PORT"
echo "PROXY_TOKEN: $PROXY_TOKEN"
echo "(também salvo em $TOKEN_FILE)"
echo
echo "Próximo passo: expor via Nginx no subpath /djen-proxy/ — ver README.md"
echo "Health check:  curl http://127.0.0.1:$APP_PORT/health"
echo "================================================================"