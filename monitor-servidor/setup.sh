#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="jc-monitor-servidor"

command -v node >/dev/null || { echo "instale Node 18+"; exit 1; }
command -v pm2 >/dev/null || npm install -g pm2

cd "$APP_DIR"
[ -d node_modules ] || npm install

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start index.js --name "$APP_NAME" --time
fi
pm2 save
pm2 startup || true

echo "OK — siga 'pm2 logs $APP_NAME'"