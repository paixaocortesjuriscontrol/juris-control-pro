#!/usr/bin/env bash
# DJEN Proxy — reparo, supervisão e renovação automática de TLS.
# Uso: curl -fsSL https://juriscontrol.adv.br/scripts/instalar-auto-renovacao-cert.sh | sudo bash
# Valores opcionais: DOMINIO=... PORTA=... SERVICO=djen-proxy APP_DIR=/home/.../djen-proxy
set -Eeuo pipefail

HOOK_DIR=/etc/letsencrypt/renewal-hooks/deploy
HOOK_FILE="$HOOK_DIR/99-reload-djen-proxy.sh"
LOG_FILE=/var/log/djen-cert-renew.log
GRUPO_CERT=letsencrypt
SERVICO="${SERVICO:-djen-proxy}"

log()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
ok()   { printf '    \033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '    \033[1;33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mERRO:\033[0m %s\n' "$*" >&2; exit 1; }
trap 'printf "\nERRO na linha %s. Consulte /var/log/letsencrypt/letsencrypt.log e journalctl -u djen-proxy.\n" "$LINENO" >&2' ERR

[ "$(id -u)" -eq 0 ] || die "rode como root (curl ... | sudo bash)"
command -v systemctl >/dev/null || die "systemd não encontrado"
command -v certbot >/dev/null || die "certbot não encontrado (apt install -y certbot)"
command -v openssl >/dev/null || die "openssl não encontrado"

log "[1/8] Detectando domínio, aplicação e porta..."
DOMINIO="${DOMINIO:-$(certbot certificates 2>/dev/null | awk '/Certificate Name:/ {print $3}' | grep -i 'juriscontrol' | head -1 || true)}"
[ -n "$DOMINIO" ] || die "certificado não encontrado; rode novamente com DOMINIO=djen-googleN.juriscontrol.adv.br"
LIVE_DIR="/etc/letsencrypt/live/$DOMINIO"
[ -r "$LIVE_DIR/fullchain.pem" ] || die "certificado ausente em $LIVE_DIR"

APP_DIR="${APP_DIR:-}"
if [ -z "$APP_DIR" ]; then
  UNIT_DIR="$(systemctl show -p WorkingDirectory --value "$SERVICO" 2>/dev/null || true)"
  [ -f "$UNIT_DIR/server.js" ] && APP_DIR="$UNIT_DIR"
fi
if [ -z "$APP_DIR" ]; then
  for cand in /home/*/djen-proxy /root/djen-proxy; do
    if [ -f "$cand/server.js" ]; then APP_DIR="$cand"; break; fi
  done
fi
[ -n "$APP_DIR" ] && [ -f "$APP_DIR/server.js" ] || die "server.js não encontrado; informe APP_DIR=/caminho/djen-proxy"

USUARIO_PROXY="${USUARIO_PROXY:-$(stat -c '%U' "$APP_DIR/server.js")}"
[ "$USUARIO_PROXY" != "UNKNOWN" ] || USUARIO_PROXY=root
ENV_FILE="$APP_DIR/.env"
TOKEN_FILE="$APP_DIR/.token"

PORTA="${PORTA:-}"
if [ -z "$PORTA" ] && [ -f "$ENV_FILE" ]; then
  PORTA="$(sed -n 's/^PORT=\([0-9][0-9]*\).*$/\1/p' "$ENV_FILE" | head -1)"
fi
PORTA="${PORTA:-8089}"
[[ "$PORTA" =~ ^[0-9]+$ ]] || die "porta inválida: $PORTA"

# Em algumas VMs o próprio Node termina o TLS (443/8443); em outras ele fica atrás
# do Nginx em HTTP. O health local precisa usar o esquema correto.
if [ "$PORTA" = 443 ] || [ "$PORTA" = 8443 ]; then
  HEALTH_URL="https://127.0.0.1:$PORTA/health"
  CURL_FLAGS="-kfsS"
else
  HEALTH_URL="http://127.0.0.1:$PORTA/health"
  CURL_FLAGS="-fsS"
fi
ok "domínio=$DOMINIO app=$APP_DIR usuário=$USUARIO_PROXY porta_local=$PORTA"

log "[2/8] Recuperando configuração e instalando serviço systemd..."
TOKEN=""
if [ -f "$ENV_FILE" ]; then TOKEN="$(sed -n 's/^PROXY_TOKEN=//p' "$ENV_FILE" | head -1)"; fi
if [ -z "$TOKEN" ] && [ -f "$TOKEN_FILE" ]; then TOKEN="$(cat "$TOKEN_FILE")"; fi
[ -n "$TOKEN" ] || die "PROXY_TOKEN não encontrado em $ENV_FILE nem $TOKEN_FILE; não gere outro, pois deve coincidir com o pool"
NODE_BIN="$(command -v node || true)"
[ -n "$NODE_BIN" ] || die "Node.js não encontrado"
NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 18+ é obrigatório"
printf 'PROXY_TOKEN=%s\nPORT=%s\n' "$TOKEN" "$PORTA" > "$ENV_FILE"
chown "$USUARIO_PROXY":"$(id -gn "$USUARIO_PROXY")" "$ENV_FILE"
chmod 600 "$ENV_FILE"

groupadd -f "$GRUPO_CERT"
[ "$USUARIO_PROXY" = root ] || usermod -aG "$GRUPO_CERT" "$USUARIO_PROXY"
chgrp -R "$GRUPO_CERT" /etc/letsencrypt/live /etc/letsencrypt/archive
chmod -R g+rX /etc/letsencrypt/live /etc/letsencrypt/archive

cat > "/etc/systemd/system/$SERVICO.service" <<UNIT
[Unit]
Description=DJEN Comunica Proxy
Wants=network-online.target
After=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=$USUARIO_PROXY
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN $APP_DIR/server.js
Restart=always
RestartSec=5
SupplementaryGroups=$GRUPO_CERT
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
UNIT
# Drop-ins antigos podem apontar para caminhos inexistentes (ex.: /root/djen-proxy)
# e travam o serviço em "Failed to load environment files".
rm -rf "/etc/systemd/system/$SERVICO.service.d"
systemctl reset-failed "$SERVICO" >/dev/null 2>&1 || true
systemctl daemon-reload
systemctl enable "$SERVICO"
# Para o serviço antes de liberar a porta; uma instância antiga pode ter sido
# iniciada manualmente ou pelo PM2 de outro usuário.
systemctl stop "$SERVICO" >/dev/null 2>&1 || true

# Remove fluxos legados PM2 de todos os usuários que possuem uma instalação.
if command -v pm2 >/dev/null 2>&1; then
  for dir in /home/*/djen-proxy /root/djen-proxy; do
    [ -d "$dir" ] || continue
    usuario_dir="$(stat -c '%U' "$dir")"
    [ "$usuario_dir" != "UNKNOWN" ] || continue
    sudo -u "$usuario_dir" pm2 stop "$SERVICO" >/dev/null 2>&1 || true
    sudo -u "$usuario_dir" pm2 delete "$SERVICO" >/dev/null 2>&1 || true
    sudo -u "$usuario_dir" pm2 save --force >/dev/null 2>&1 || true
  done
fi

# Encerra somente processos Node do DJEN Proxy que ainda ocupem a porta.
# Não usa fuser -k indiscriminadamente para evitar matar outro serviço.
PIDS_PORTA="$(ss -H -ltnp "sport = :$PORTA" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)"
for pid in $PIDS_PORTA; do
  cmdline="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
  if [[ "$cmdline" == *node* && "$cmdline" == *djen-proxy/server.js* ]]; then
    warn "encerrando proxy legado PID $pid que ocupava a porta $PORTA"
    kill -TERM "$pid" 2>/dev/null || true
  else
    die "porta $PORTA ocupada pelo PID $pid ($cmdline); não encerrei por segurança"
  fi
done
for tentativa in 1 2 3 4 5; do
  ss -H -ltn "sport = :$PORTA" 2>/dev/null | grep -q . || break
  sleep 1
done
PIDS_PORTA="$(ss -H -ltnp "sport = :$PORTA" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)"
for pid in $PIDS_PORTA; do
  cmdline="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
  if [[ "$cmdline" == *node* && "$cmdline" == *djen-proxy/server.js* ]]; then
    warn "proxy legado PID $pid não encerrou; aplicando SIGKILL"
    kill -KILL "$pid" 2>/dev/null || true
  else
    die "porta $PORTA continua ocupada pelo PID $pid ($cmdline)"
  fi
done
systemctl restart "$SERVICO"
ok "$SERVICO.service instalado, habilitado no boot e reiniciado"

# Nas VMs em que o TLS público termina no Nginx, conexão recusada em 443 pode
# significar que o proxy local está vivo, mas o Nginx ficou parado.
if systemctl cat nginx.service >/dev/null 2>&1; then
  if nginx -t; then
    systemctl enable nginx
    systemctl restart nginx
    ok "nginx validado, habilitado no boot e reiniciado"
  else
    warn "configuração do nginx inválida; proxy local foi recuperado, mas o HTTPS externo exige correção do nginx"
  fi
fi

log "[3/8] Instalando autorrecuperação a cada 5 minutos..."
cat > "/etc/systemd/system/$SERVICO-health.service" <<UNIT
[Unit]
Description=Health check e recuperação do DJEN Proxy
After=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'set -e; if ! /usr/bin/curl $CURL_FLAGS --max-time 10 $HEALTH_URL >/dev/null; then /usr/bin/systemctl restart $SERVICO; sleep 3; /usr/bin/curl $CURL_FLAGS --max-time 10 $HEALTH_URL >/dev/null; fi; if systemctl cat nginx.service >/dev/null 2>&1; then if ! systemctl is-active --quiet nginx || ! /usr/bin/curl -kfsS --resolve $DOMINIO:443:127.0.0.1 --max-time 10 https://$DOMINIO/health >/dev/null; then nginx -t && systemctl restart nginx; sleep 3; /usr/bin/curl -kfsS --resolve $DOMINIO:443:127.0.0.1 --max-time 10 https://$DOMINIO/health >/dev/null; fi; fi'
UNIT
cat > "/etc/systemd/system/$SERVICO-health.timer" <<UNIT
[Unit]
Description=Executa health check do DJEN Proxy a cada 5 minutos

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now "$SERVICO-health.timer"
ok "watchdog ativo: $SERVICO-health.timer"

log "[4/8] Garantindo agendamento do Certbot..."
if systemctl cat certbot.timer >/dev/null 2>&1; then
  systemctl enable --now certbot.timer
  TIMER_CERT=certbot.timer
elif systemctl cat snap.certbot.renew.timer >/dev/null 2>&1; then
  systemctl enable --now snap.certbot.renew.timer
  TIMER_CERT=snap.certbot.renew.timer
else
  cat > /etc/cron.d/djen-certbot-renew <<'CRON'
17 3,15 * * * root certbot renew --quiet >> /var/log/djen-cert-renew.log 2>&1
CRON
  chmod 644 /etc/cron.d/djen-certbot-renew
  TIMER_CERT=cron
fi
ok "renovação agendada por $TIMER_CERT"

log "[5/8] Instalando hook pós-renovação..."
mkdir -p "$HOOK_DIR"
cat > "$HOOK_FILE" <<HOOK
#!/usr/bin/env bash
set -uo pipefail
LOG="$LOG_FILE"
registra() { echo "\$(date '+%Y-%m-%d %H:%M:%S%z') [\${RENEWED_DOMAINS:-?}] \$*" >> "\$LOG"; }
chgrp -R "$GRUPO_CERT" /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true
chmod -R g+rX /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true
if systemctl cat nginx.service >/dev/null 2>&1; then
  nginx -t >/dev/null 2>&1 && systemctl restart nginx && registra "nginx reiniciado" || registra "FALHA ao reiniciar nginx"
fi
if systemctl restart "$SERVICO"; then
  sleep 2
  curl $CURL_FLAGS --max-time 10 "$HEALTH_URL" >/dev/null \
    && registra "$SERVICO reiniciado e saudável" \
    || registra "FALHA: $SERVICO reiniciou sem responder ao health"
else
  registra "FALHA ao reiniciar $SERVICO"
fi
HOOK
chmod 750 "$HOOK_FILE"
touch "$LOG_FILE"
chmod 640 "$LOG_FILE"
ok "hook instalado em $HOOK_FILE"

log "[6/8] Testando proxy local..."
for tentativa in 1 2 3 4 5; do
  if curl $CURL_FLAGS --max-time 10 "$HEALTH_URL" >/dev/null; then break; fi
  [ "$tentativa" -lt 5 ] || { systemctl status "$SERVICO" --no-pager -l || true; journalctl -u "$SERVICO" -n 30 --no-pager || true; die "proxy local não respondeu"; }
  sleep 2
done
ok "health local respondeu"

log "[7/8] Simulando renovação real..."
DRY_LOG="$(mktemp)"
if certbot renew --dry-run --cert-name "$DOMINIO" >"$DRY_LOG" 2>&1; then
  tail -20 "$DRY_LOG"
  ok "dry-run passou"
else
  tail -40 "$DRY_LOG"
  rm -f "$DRY_LOG"
  die "dry-run falhou"
fi
rm -f "$DRY_LOG"

log "[8/8] Validando serviço e TLS externo..."
systemctl is-active --quiet "$SERVICO" || die "$SERVICO não está ativo"
systemctl is-enabled --quiet "$SERVICO" || die "$SERVICO não está habilitado no boot"
systemctl is-active --quiet "$SERVICO-health.timer" || die "watchdog não está ativo"
if systemctl cat nginx.service >/dev/null 2>&1; then
  systemctl is-enabled --quiet nginx || die "nginx não está habilitado no boot"
  systemctl is-active --quiet nginx || die "nginx não está ativo"
fi
echo | openssl s_client -connect "$DOMINIO:443" -servername "$DOMINIO" 2>/dev/null \
  | openssl x509 -noout -dates 2>/dev/null || warn "TLS externo na porta 443 não respondeu; confira Nginx e firewall"
echo
ok "PROXY REPARADO E AUTO-RENOVAÇÃO VALIDADA"
echo "    Serviço: systemctl status $SERVICO --no-pager"
echo "    Watchdog: systemctl list-timers $SERVICO-health.timer --no-pager"
echo "    Certbot:  systemctl list-timers | grep -i certbot"
echo "    Log:      tail -30 $LOG_FILE"