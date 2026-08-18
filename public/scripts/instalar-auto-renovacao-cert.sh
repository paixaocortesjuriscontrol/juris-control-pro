#!/usr/bin/env bash
# ============================================================================
# DJEN Proxy — instalador de AUTO-RENOVAÇÃO de certificado TLS
#
# Rode UMA VEZ em cada VM do pool (vm01, vm02, vm09), como root:
#   sudo bash instalar-auto-renovacao-cert.sh
#
# Opcional (o script detecta sozinho, mas dá para forçar):
#   sudo DOMINIO=djen-google2.juriscontrol.adv.br PORTA=8443 SERVICO=djen-proxy \
#        bash instalar-auto-renovacao-cert.sh
#
# O que ele garante:
#  1) timer do certbot ativo (renovação automática 2x/dia)
#  2) hook de deploy que reinicia o proxy APÓS cada renovação
#  3) permissões de leitura dos certificados para o usuário do proxy
#  4) validação imediata com `certbot renew --dry-run`
#
# Idempotente: pode rodar quantas vezes quiser.
# ============================================================================
set -euo pipefail

HOOK_DIR="/etc/letsencrypt/renewal-hooks/deploy"
HOOK_FILE="$HOOK_DIR/99-reload-djen-proxy.sh"
LOG_FILE="/var/log/djen-cert-renew.log"
GRUPO_CERT="letsencrypt"

log()  { echo -e "\033[1;36m==>\033[0m $*"; }
ok()   { echo -e "    \033[1;32m✓\033[0m $*"; }
warn() { echo -e "    \033[1;33m!\033[0m $*"; }
die()  { echo -e "\033[1;31mERRO:\033[0m $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "rode com sudo: sudo bash $0"
command -v certbot >/dev/null 2>&1 || die "certbot não encontrado (sudo apt install -y certbot)"

# ---------------------------------------------------------------------------
# [1/6] Detecta ambiente
# ---------------------------------------------------------------------------
log "[1/6] Detectando ambiente..."

SERVICO="${SERVICO:-}"
if [ -z "$SERVICO" ]; then
  for cand in djen-proxy djen-vps-proxy; do
    if systemctl list-unit-files "${cand}.service" >/dev/null 2>&1 \
       && systemctl cat "${cand}.service" >/dev/null 2>&1; then
      SERVICO="$cand"; break
    fi
  done
fi
if [ -n "$SERVICO" ]; then
  ok "serviço do proxy: ${SERVICO}.service"
else
  warn "nenhum serviço systemd do proxy encontrado — o hook só recarregará o Nginx"
fi

DOMINIO="${DOMINIO:-}"
if [ -z "$DOMINIO" ]; then
  HOST_CURTO="$(hostname -s || true)"
  # tenta casar o número da VM (vm01 -> djen-google, vm02 -> djen-google2, vm09 -> djen-google9)
  DOMINIO="$(certbot certificates 2>/dev/null \
    | awk '/Certificate Name:/ {print $3}' | grep -i 'juriscontrol' | head -1 || true)"
fi
[ -n "$DOMINIO" ] || die "não consegui detectar o domínio. Rode com DOMINIO=seu.dominio sudo bash $0"
ok "domínio do certificado: $DOMINIO"

LIVE_DIR="/etc/letsencrypt/live/$DOMINIO"
[ -d "$LIVE_DIR" ] || die "não existe $LIVE_DIR — emita o certificado antes (certbot certonly)"

PORTA="${PORTA:-}"
if [ -z "$PORTA" ] && [ -n "$SERVICO" ]; then
  EXEC_DIR="$(systemctl show -p WorkingDirectory --value "$SERVICO" 2>/dev/null || true)"
  if [ -n "$EXEC_DIR" ] && [ -f "$EXEC_DIR/.env" ]; then
    PORTA="$(grep -oP '^PORT=\K[0-9]+' "$EXEC_DIR/.env" 2>/dev/null | head -1 || true)"
  fi
fi
PORTA="${PORTA:-443}"
ok "porta do proxy: $PORTA"

USUARIO_PROXY="${USUARIO_PROXY:-}"
if [ -z "$USUARIO_PROXY" ] && [ -n "$SERVICO" ]; then
  USUARIO_PROXY="$(systemctl show -p User --value "$SERVICO" 2>/dev/null || true)"
fi
[ -n "${USUARIO_PROXY:-}" ] || USUARIO_PROXY="root"
ok "usuário do proxy: $USUARIO_PROXY"

# ---------------------------------------------------------------------------
# [2/6] Timer do certbot
# ---------------------------------------------------------------------------
log "[2/6] Garantindo timer de renovação automática do certbot..."
if systemctl list-unit-files certbot.timer >/dev/null 2>&1 \
   && systemctl cat certbot.timer >/dev/null 2>&1; then
  systemctl enable --now certbot.timer
  ok "certbot.timer ativo"
  systemctl list-timers certbot.timer --no-pager | sed -n '1,3p' || true
elif systemctl cat snap.certbot.renew.timer >/dev/null 2>&1; then
  systemctl enable --now snap.certbot.renew.timer
  ok "snap.certbot.renew.timer ativo"
else
  warn "nenhum timer do certbot encontrado — criando cron diário de segurança"
  cat > /etc/cron.d/djen-certbot-renew <<'CRON'
# Renovação de certificado do proxy DJEN (rede de segurança quando não há timer systemd)
17 3,15 * * * root certbot renew --quiet
CRON
  chmod 644 /etc/cron.d/djen-certbot-renew
  ok "cron criado em /etc/cron.d/djen-certbot-renew (03:17 e 15:17)"
fi

# ---------------------------------------------------------------------------
# [3/6] Permissões dos certificados
# ---------------------------------------------------------------------------
log "[3/6] Ajustando permissões de leitura dos certificados..."
groupadd -f "$GRUPO_CERT"
if [ "$USUARIO_PROXY" != "root" ]; then
  usermod -aG "$GRUPO_CERT" "$USUARIO_PROXY"
  ok "usuário $USUARIO_PROXY adicionado ao grupo $GRUPO_CERT"
fi
chgrp -R "$GRUPO_CERT" /etc/letsencrypt/live /etc/letsencrypt/archive
chmod -R g+rX /etc/letsencrypt/live /etc/letsencrypt/archive
ok "live/ e archive/ legíveis pelo grupo $GRUPO_CERT"

# ---------------------------------------------------------------------------
# [4/6] Hook de deploy (reinicia o proxy após cada renovação)
# ---------------------------------------------------------------------------
log "[4/6] Instalando hook de deploy do Let's Encrypt..."
mkdir -p "$HOOK_DIR"
cat > "$HOOK_FILE" <<HOOK
#!/usr/bin/env bash
# Gerado por instalar-auto-renovacao-cert.sh — reinicia o proxy DJEN após cada
# renovação de certificado. NÃO renova nada: só recarrega quem usa o certificado.
set -uo pipefail

LOG="$LOG_FILE"
GRUPO="$GRUPO_CERT"
SERVICO="${SERVICO:-}"

registra() { echo "\$(date '+%Y-%m-%d %H:%M:%S%z') [\${RENEWED_DOMAINS:-?}] \$*" >> "\$LOG"; }

# 1) reaplica permissões (certbot recria os arquivos em archive/ como root)
groupadd -f "\$GRUPO" 2>/dev/null || true
chgrp -R "\$GRUPO" /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true
chmod -R g+rX /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true
registra "permissoes reaplicadas"

# 2) Nginx, se ativo
if systemctl is-active --quiet nginx; then
  if nginx -t 2>/dev/null; then
    systemctl reload nginx && registra "nginx recarregado" || registra "FALHA ao recarregar nginx"
  else
    registra "FALHA: nginx -t invalido, reload abortado"
  fi
fi

# 3) proxy DJEN
if [ -n "\$SERVICO" ] && systemctl cat "\$SERVICO.service" >/dev/null 2>&1; then
  if systemctl restart "\$SERVICO"; then
    registra "\$SERVICO reiniciado"
  else
    registra "FALHA ao reiniciar \$SERVICO"
  fi
fi
HOOK
chmod +x "$HOOK_FILE"
touch "$LOG_FILE"; chmod 640 "$LOG_FILE"
ok "hook criado: $HOOK_FILE"
ok "log de renovações: $LOG_FILE"

# ---------------------------------------------------------------------------
# [5/6] Simulação de renovação
# ---------------------------------------------------------------------------
log "[5/6] Simulando renovação (certbot renew --dry-run)..."
if certbot renew --dry-run --cert-name "$DOMINIO" 2>&1 | tail -20; then
  ok "dry-run passou — a renovação automática vai funcionar"
else
  die "dry-run FALHOU. Corrija antes de confiar na renovação automática (veja /var/log/letsencrypt/letsencrypt.log)"
fi

# ---------------------------------------------------------------------------
# [6/6] Estado atual
# ---------------------------------------------------------------------------
log "[6/6] Estado atual do certificado e do serviço..."
echo | openssl s_client -connect "127.0.0.1:$PORTA" -servername "$DOMINIO" 2>/dev/null \
  | openssl x509 -noout -dates 2>/dev/null || warn "não consegui ler o certificado na porta $PORTA"

if [ -n "$SERVICO" ]; then
  systemctl is-enabled "$SERVICO" >/dev/null 2>&1 || warn "$SERVICO não está habilitado no boot (sudo systemctl enable $SERVICO)"
  systemctl status "$SERVICO" --no-pager -l | sed -n '1,6p' || true
fi

echo
ok "AUTO-RENOVAÇÃO CONFIGURADA em $DOMINIO"
echo "    Conferir depois:  sudo systemctl list-timers | grep -i certbot"
echo "    Log de renovações: sudo tail -20 $LOG_FILE"
