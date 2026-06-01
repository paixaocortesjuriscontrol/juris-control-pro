# DJEN Proxy v3 — Multi-IP na Google VPS

Servidor Node nativo (sem dependências) que repassa GETs ao PJE Comunica e
suporta **N IPs públicos saindo da mesma VM Google** via `localAddress`.

> **VM alvo nesta iteração:** `djen-termos-vm06-multi` (zona
> `southamerica-east1-a`). As outras 5 VMs (`djentermosvm01` e
> `djen-termos-vm02..05`) NÃO são tocadas — continuam rodando o proxy antigo
> single-IP.

## 1) Reservar 5 IPs estáticos em `southamerica-east1`

```bash
for i in 1 2 3 4 5; do
  gcloud compute addresses create djen-vm06-ip-$i \
    --region=southamerica-east1
done

gcloud compute addresses list --filter="region:southamerica-east1 AND name~djen-vm06"
# anote EXTERNAL_IP_1..5
```

## 2) Criar a VM `djen-termos-vm06-multi` com os 5 IPs anexados

O GCP faz **NAT 1:1** entre cada IP interno alias (`/32`) e o IP externo
correspondente. Limite GCP: até 10 access-configs por NIC.

```bash
VM=djen-termos-vm06-multi
ZONE=southamerica-east1-a

# 1. Criar a VM já com o IP-1 como access-config principal
IP1=$(gcloud compute addresses describe djen-vm06-ip-1 \
  --region=southamerica-east1 --format='value(address)')

gcloud compute instances create $VM \
  --zone=$ZONE \
  --machine-type=e2-small \
  --image-family=debian-12 --image-project=debian-cloud \
  --tags=djen-proxy \
  --address=$IP1

# 2. Criar 4 alias IP ranges (/32) na nic0 para os IPs 2..5
gcloud compute instances network-interfaces update $VM \
  --zone=$ZONE \
  --aliases="10.128.0.20/32,10.128.0.21/32,10.128.0.22/32,10.128.0.23/32"

# 3. Anexar 1 access-config (= IP público) para cada alias
for i in 2 3 4 5; do
  EXT=$(gcloud compute addresses describe djen-vm06-ip-$i \
    --region=southamerica-east1 --format='value(address)')
  gcloud compute instances add-access-config $VM --zone=$ZONE \
    --access-config-name="multi-ip-$i" \
    --address=$EXT
done

# 4. Firewall (uma vez só, se ainda não existir)
gcloud compute firewall-rules create allow-djen-proxy-8089 \
  --allow=tcp:8089 --target-tags=djen-proxy --source-ranges=0.0.0.0/0 || true
```

> Limite GCP: até 10 access-configs por NIC. Custo ~US\$1,46/IP/mês quando a
> VM está rodando. IP estático **não atribuído** custa US\$7/mês — só
> reserve depois de planejar o uso.

## 3) Configurar o `server.js`

SSH na VM, clone (ou `scp`) a pasta `gcp-djen-proxy/` para `~/djen-proxy/`.

`.env` (ou `pm2 ecosystem`):

```
PROXY_TOKEN=cole_o_mesmo_token_que_está_cadastrado_no_Pool
PORT=8089
LOCAL_IPS=10.128.0.2,10.128.0.20,10.128.0.21,10.128.0.22,10.128.0.23
```

- O 1º IP da lista é o IP interno padrão da nic0 (sai pelo IP-1).
- Os demais são os aliases criados no passo 2, na **mesma ordem** dos
  access-configs (IP-2..IP-5).
- Confira os IPs internos reais com `ip -4 addr show`.
- Sem `LOCAL_IPS` o servidor cai em modo legado (single-IP). Não há quebra
  de retro-compat com as VMs antigas.

## 4) Reload graceful (sem parar consulta em andamento)

```bash
pm2 reload djen-proxy
# ou, se for primeiro start:
# pm2 start server.js --name djen-proxy --update-env
```

`pm2 reload` mantém as conexões em voo até terminarem, depois faz o swap.
A "DJEN Termos Paralela" não percebe — slots que falharem por timing são
marcados offline por 60s pelo próprio pool, e os outros slots (Hostinger +
demais Google) atendem normalmente.

## 5) Validar

```bash
curl -s https://djen-google.juriscontrol.adv.br/health
curl -s https://djen-google.juriscontrol.adv.br/whoami      # IP padrão
curl -s https://djen-google.juriscontrol.adv.br/whoami/2    # IP slot 2
curl -s https://djen-google.juriscontrol.adv.br/whoami/5    # IP slot 5
```

Cada `/whoami/N` deve devolver um IP público diferente.

## 6) Cadastrar os IPs novos no Pool da Lovable

Em **Configurações → Pool de Proxies DJEN**:

1. Cadastre **manualmente 1 slot**: `baseUrl=http://EXTERNAL_IP_1:8089`,
   `label=Google VPS 6 — Multi-IP`, token igual ao `PROXY_TOKEN`.
2. Salve. A linha mostra o botão **"+ Multi-IP"** (aparece porque `/whoami`
   respondeu).
3. Clique no botão. O diálogo descobre automaticamente IP-2..IP-5 via
   `/whoami/2..5` e cria 4 slots adicionais (`Google VPS 6 — IP 2/3/4/5`)
   apontando para `/proxy/2..5` com o mesmo token.
4. Os 5 slots entram no round-robin imediatamente, somando aos das vm01..vm05.

## Endpoints

| Método | Path           | Descrição                                            |
|--------|----------------|------------------------------------------------------|
| GET    | `/health`      | status + IP padrão + ip_count                        |
| GET    | `/whoami`      | IP público real do socket padrão                     |
| GET    | `/whoami/N`    | IP público real ao sair via `LOCAL_IPS[N-1]`         |
| GET    | `/proxy?url=…` | proxy cru (IP padrão) — compatível com versão antiga |
| GET    | `/proxy/N?url=…` | proxy cru saindo por `LOCAL_IPS[N-1]`              |

`/proxy*` exige header `X-Proxy-Token`. `/whoami*` e `/health` são públicos
(não vazam segredo — só dizem qual IP a VPS está usando).