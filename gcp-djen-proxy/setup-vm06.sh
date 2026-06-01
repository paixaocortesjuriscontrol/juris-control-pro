#!/usr/bin/env bash
# ============================================================
# Provisiona a VM djen-termos-vm06-multi com 5 IPs públicos.
# Rode no Cloud Shell ou em qualquer máquina com gcloud autenticado.
# Idempotente: pode ser re-executado; comandos já-feitos falham em silêncio.
# ============================================================
set -euo pipefail

PROJECT="${PROJECT:-$(gcloud config get-value project)}"
REGION="${REGION:-southamerica-east1}"
ZONE="${ZONE:-southamerica-east1-a}"
VM="${VM:-djen-termos-vm06-multi}"
TAG="djen-proxy"
PORT="${PORT:-8089}"

echo ">> Projeto: $PROJECT | Zona: $ZONE | VM: $VM"

# 1) Reservar 5 IPs estáticos
for i in 1 2 3 4 5; do
  gcloud compute addresses create "djen-vm06-ip-$i" \
    --region="$REGION" --project="$PROJECT" 2>/dev/null \
    || echo "   IP djen-vm06-ip-$i já existe — ok"
done

IP1=$(gcloud compute addresses describe djen-vm06-ip-1 \
  --region="$REGION" --project="$PROJECT" --format='value(address)')

# 2) Criar VM com IP-1 como access-config principal
if ! gcloud compute instances describe "$VM" --zone="$ZONE" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud compute instances create "$VM" \
    --project="$PROJECT" --zone="$ZONE" \
    --machine-type=e2-small \
    --image-family=debian-12 --image-project=debian-cloud \
    --tags="$TAG" \
    --address="$IP1"
else
  echo "   VM $VM já existe — ok"
fi

# 3) Adicionar alias IPs internos (/32) para 4 IPs extras
gcloud compute instances network-interfaces update "$VM" \
  --project="$PROJECT" --zone="$ZONE" \
  --aliases="10.128.0.20/32,10.128.0.21/32,10.128.0.22/32,10.128.0.23/32" \
  || echo "   aliases já configurados — ok"

# 4) Anexar access-configs para IPs 2..5
for i in 2 3 4 5; do
  EXT=$(gcloud compute addresses describe "djen-vm06-ip-$i" \
    --region="$REGION" --project="$PROJECT" --format='value(address)')
  gcloud compute instances add-access-config "$VM" \
    --project="$PROJECT" --zone="$ZONE" \
    --access-config-name="multi-ip-$i" \
    --address="$EXT" 2>/dev/null \
    || echo "   access-config multi-ip-$i já anexado — ok"
done

# 5) Firewall TCP $PORT (uma vez)
gcloud compute firewall-rules create "allow-djen-proxy-$PORT" \
  --project="$PROJECT" \
  --allow="tcp:$PORT" --target-tags="$TAG" --source-ranges=0.0.0.0/0 \
  2>/dev/null || echo "   regra de firewall já existe — ok"

echo ""
echo "============================================================"
echo "OK. IPs externos atribuídos à $VM:"
gcloud compute addresses list \
  --project="$PROJECT" \
  --filter="region:$REGION AND name~djen-vm06" \
  --format="table(name,address,status)"
echo ""
echo "Próximo passo: SSH na VM e rodar:"
echo "  sudo apt-get update && sudo apt-get install -y nodejs npm git"
echo "  sudo npm install -g pm2"
echo "  git clone <REPO> ~/djen-proxy && cd ~/djen-proxy/gcp-djen-proxy"
echo "  cat > .env <<EOF"
echo "  PROXY_TOKEN=<seu-token-do-pool>"
echo "  PORT=$PORT"
echo "  LOCAL_IPS=\$(ip -4 -o addr show | awk '/10\\.128/ {print \$4}' | cut -d/ -f1 | paste -sd,)"
echo "  EOF"
echo "  pm2 start server.js --name djen-proxy-vm06 --update-env && pm2 save"
echo "============================================================"