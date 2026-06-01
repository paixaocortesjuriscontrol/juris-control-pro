
# Nova VM Google `djen-termos-vm06-multi` com 5 IPs (zero impacto nas atuais)

## Objetivo
Criar uma 6ª VM no GCP que sozinha expõe **5 IPs públicos** distintos para o DJEN, usados em round-robin pelo Pool Proxy. As 5 VMs existentes (vm01..vm05) **não são tocadas** — continuam rodando o `server.js` antigo com 1 IP cada.

## Escopo
- **Incluído**: provisionar 1 VM nova + 5 IPs reservados + deploy do `gcp-djen-proxy/server.js` v3 (já existe no repo) + cadastro automático dos 5 slots no Pool DJEN via botão "+ Multi-IP".
- **Fora**: alterar vm01..vm05, mudar round-robin, persistir nada novo no Supabase (slots já cabem em `djen_proxy_pool`).

## Infra GCP (executado por você no console/gcloud, fora do Lovable)

1. Reservar 5 IPs estáticos em `southamerica-east1`:
   ```
   gcloud compute addresses create djen-vm06-ip1 djen-vm06-ip2 djen-vm06-ip3 djen-vm06-ip4 djen-vm06-ip5 \
     --region=southamerica-east1
   ```
2. Criar a VM `djen-termos-vm06-multi` (e2-small, Debian 12, zona `southamerica-east1-a`) anexando os 5 IPs como access-configs alias na nic0:
   ```
   gcloud compute instances create djen-termos-vm06-multi \
     --zone=southamerica-east1-a \
     --machine-type=e2-small \
     --image-family=debian-12 --image-project=debian-cloud \
     --tags=djen-proxy
   # Depois, adicionar os 4 IPs extras como aliases (o 1º já vem no nic0):
   gcloud compute instances add-access-config djen-termos-vm06-multi \
     --zone=southamerica-east1-a --address=djen-vm06-ip2 ...
   ```
   (detalhes completos em `gcp-djen-proxy/README.md`)
3. Liberar firewall TCP 8080 com tag `djen-proxy` (se ainda não houver).

## Deploy do proxy v3 (você na VM)
1. `git clone` do repo, `cd gcp-djen-proxy && npm i`.
2. Criar `.env`:
   ```
   PROXY_TOKEN=<token igual ao usado nos slots>
   LOCAL_IPS=<IP1>,<IP2>,<IP3>,<IP4>,<IP5>
   PORT=8080
   ```
3. `pm2 start server.js --name djen-proxy-vm06 && pm2 save`.
4. Validar: `curl http://<IP1>:8080/whoami/1` … `/whoami/5` devem retornar 5 IPs diferentes.

## Cadastro na tela `/configuracoes` → Pool Proxy DJEN (zero código novo)

Fluxo já implementado em `PoolProxyDjenCard.tsx`:

1. Você adiciona **1 slot manual** apontando para `http://<IP1>:8080` com label `Google VPS 6 — Multi-IP` e o token.
2. Na linha do slot aparece o botão **"+ Multi-IP"** (porque `/whoami` responde).
3. Clicar abre o dialog que faz probe em `/whoami/2..5`, lista os 4 IPs detectados, e ao confirmar cria 4 slots adicionais (`Google VPS 6 — IP 2`, `IP 3`, `IP 4`, `IP 5`) — todos com o mesmo `base_url` + sufixo `/proxy/N` e o mesmo token.
4. Os 5 slots entram no round-robin do `djenProxyPool` na próxima requisição. As vm01..vm05 continuam intocadas no pool.

## Pontos técnicos
- `gcp-djen-proxy/server.js` v3 já lê `LOCAL_IPS` (CSV) e roteia via `https.request({ localAddress })` por índice.
- `buildV3ProxyUrl` já detecta `/proxy/N` no `base_url` para evitar duplicar path.
- `fetchSlotPublicIp` (5 min cache) mostra o IP real no chip de cada slot.
- Sem migration: `djen_proxy_pool` já tem `base_url`, `token`, `label`, `enabled`.

## Rollback
Desabilitar os 5 slots no Pool (toggle `enabled=false`) — round-robin volta a usar só as vm01..vm05.

## Resultado final
Pool DJEN passa de 5 para **10 IPs ativos** (5 das VMs antigas + 5 da vm06), todos rotacionados igualmente, aumentando ~2× a vazão antes de bater 429.
