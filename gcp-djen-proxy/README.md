# DJEN Proxy v3 — Multi-IP na Google VPS

Servidor Node nativo (sem dependências) que repassa GETs ao PJE Comunica e
suporta **N IPs públicos saindo da mesma VM Google** via `localAddress`.

## 1) Reservar 4 IPs estáticos extras em `southamerica-east1`

```bash
for i in 2 3 4 5; do
  gcloud compute addresses create djen-vps1-ip-$i \
    --region=southamerica-east1
done

gcloud compute addresses list --filter="region:southamerica-east1"
# anote os endereços externos (EXTERNAL_IP_2..5)
```

## 2) Anexar como access-configs adicionais na nic0

Substitua `VM_NAME`, `ZONE` e os IPs externos. O GCP faz **NAT 1:1** entre
cada IP interno alias (`/32`) e o IP externo correspondente.

```bash
VM=vm-djen-google
ZONE=southamerica-east1-a

# 1. Cria 4 alias IP ranges (/32) na nic0
gcloud compute instances network-interfaces update $VM \
  --zone=$ZONE \
  --aliases="10.128.0.10/32,10.128.0.11/32,10.128.0.12/32,10.128.0.13/32"

# 2. Anexa um access-config (=IP público) para cada alias
for i in 2 3 4 5; do
  EXT=$(gcloud compute addresses describe djen-vps1-ip-$i \
    --region=southamerica-east1 --format='value(address)')
  gcloud compute instances add-access-config $VM --zone=$ZONE \
    --access-config-name="multi-ip-$i" \
    --address=$EXT
done
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
LOCAL_IPS=10.128.0.2,10.128.0.10,10.128.0.11,10.128.0.12,10.128.0.13
```

- O 1º IP da lista é o IP interno padrão da nic0 (mantém o IP público antigo).
- Os demais são os aliases criados no passo 2, na **mesma ordem** dos
  access-configs.
- Sem `LOCAL_IPS` o servidor cai em modo legado (single-IP, igual versão
  anterior). Não há quebra de retro-compat.

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

Na tela **Configurações → Pool de Proxies DJEN**, na linha da Google VPS 1,
clique em **"+ Multi-IP"**. O diálogo descobre automaticamente os IPs via
`/whoami/N`; salve `/proxy/2`, `/proxy/3`, `/proxy/4` e `/proxy/5` como
slots independentes. Cada um vira uma entrada no round-robin imediatamente.

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