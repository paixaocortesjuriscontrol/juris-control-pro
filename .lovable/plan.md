# Renovar certificados e restaurar VPS do pool DJEN

## O que causou o erro na vm02

O comando foi rodado na vm02 usando o domínio da vm01. Cada VM tem o seu próprio domínio, confirmado agora no DNS:

| VM | Domínio correto | IP |
|---|---|---|
| vm01 | djen-google.juriscontrol.adv.br | 35.247.201.135 |
| vm02 | djen-google2.juriscontrol.adv.br | 34.39.217.255 |
| vm09 | djen-google9.juriscontrol.adv.br | 34.39.248.189 |

Como `djen-google` aponta para 35.247.201.135, a Let's Encrypt foi validar na vm01 enquanto o servidor temporário do certbot estava de pé na vm02 — daí o 404. **Regra: nunca usar o domínio de uma VM em outra.**

Na vm02 o Nginx é quem ocupa as portas 80 e 443, e o PM2 está vazio. Então nela o caminho mais seguro é usar o **plugin nginx** do certbot, que valida sem derrubar o serviço.

## Etapa 1 — vm02: confirmar o domínio e quem serve o proxy

```bash
sudo certbot certificates
hostname -f
sudo grep -rn "server_name\|proxy_pass" /etc/nginx/sites-enabled/
sudo systemctl list-units --type=service --state=running | grep -i djen
```

Isso confirma o nome exato do certificado e qual serviço responde em `/health`.

## Etapa 2 — vm02: renovar com o plugin nginx

```bash
sudo certbot --nginx \
  --cert-name djen-google2.juriscontrol.adv.br \
  -d djen-google2.juriscontrol.adv.br \
  --force-renewal --non-interactive --agree-tos --redirect
```

Se o plugin nginx não estiver instalado:

```bash
sudo apt update && sudo apt install -y python3-certbot-nginx
```

Alternativa, caso o plugin falhe (usa servidor temporário, para o Nginx por poucos segundos):

```bash
sudo certbot certonly --standalone \
  --cert-name djen-google2.juriscontrol.adv.br \
  -d djen-google2.juriscontrol.adv.br \
  --pre-hook "systemctl stop nginx" \
  --post-hook "systemctl start nginx" \
  --force-renewal --non-interactive --agree-tos
```

## Etapa 3 — vm02: recarregar e validar

```bash
sudo nginx -t && sudo systemctl reload nginx

curl -s https://djen-google2.juriscontrol.adv.br/health
# esperado: {"ok":true,...}

echo | openssl s_client -connect djen-google2.juriscontrol.adv.br:443 2>/dev/null \
  | openssl x509 -noout -dates
```

`notAfter` deve ficar ~90 dias à frente.

## Etapa 4 — vm01: mesma sequência com o domínio dela

Na vm01, primeiro descobrir quem ocupa a porta 80:

```bash
sudo ss -tlnp | grep -E ':80 |:443 '
systemctl is-active nginx && echo "nginx ativo" || echo "nginx inativo"
pm2 list
```

Se for Nginx, usar o plugin nginx:

```bash
sudo certbot --nginx \
  --cert-name djen-google.juriscontrol.adv.br \
  -d djen-google.juriscontrol.adv.br \
  --force-renewal --non-interactive --agree-tos --redirect
```

Se for o proxy Node sob PM2 na porta 80:

```bash
sudo certbot certonly --standalone \
  --cert-name djen-google.juriscontrol.adv.br \
  -d djen-google.juriscontrol.adv.br \
  --pre-hook "su - contato -c 'pm2 stop all'" \
  --post-hook "su - contato -c 'pm2 start all'" \
  --force-renewal --non-interactive --agree-tos
```

Depois recarregar o serviço (`systemctl reload nginx` ou `pm2 restart all`) e validar com `curl` **sem** `-k`, igual à Etapa 3.

## Etapa 5 — Religar a renovação automática (vm01 e vm02)

O que faltava era o reload do serviço depois de cada renovação — foi por isso que travou em julho.

Criar um script de hook de deploy do Let's Encrypt (em `renewal-hooks/deploy/`) que recarrega o Nginx quando ativo e reinicia o PM2 quando existir, marcar como executável, e confirmar:

```bash
sudo systemctl list-timers | grep -i certbot
sudo certbot renew --dry-run
```

O `--dry-run` precisa passar em ambas as VMs. Entrego o conteúdo exato do script no momento da execução.

## Etapa 6 — vm09: religar o serviço

```bash
pm2 list
pm2 resurrect
ls -la ~/djen-proxy/
sudo ss -tlnp | grep -E ':80 |:443 |:8089 |:8443 '
curl -s http://127.0.0.1:8089/health
```

Se não houver processo, subir do zero:

```bash
cd ~/djen-proxy && bash setup.sh
```

Conferir também a regra de firewall da VPC liberando a porta usada e, se o certificado de `djen-google9.juriscontrol.adv.br` estiver vencido, aplicar as Etapas 2, 3 e 5 nela.

## Etapa 7 — Validar o pool no app

1. Quando a vm09 responder `/health` de fora, vá em **Configurações → Pool de Proxies DJEN** e reative o slot "Google VPS 9".
2. Clique em **Testar agora** nos três slots reparados.
3. Os selos devem ficar verdes, com latência e `cert_expira_em` ~90 dias à frente.

O monitor diário (`verificar-saude-pool-djen`, 8h BRT) grava `saude_status`, `saude_motivo`, `latencia_ms` e `cert_expira_em`, e avisa por e-mail a 30, 15, 7 e 1 dia do vencimento — então esse cenário não volta a acontecer sem aviso.

## Fora de escopo

Ajuste de timeout/orçamento do motor paralelo (`DJEN_PROXY_TIMEOUT_MS` / `PARALELA_UNIT_BUDGET_MS`) fica para depois que o pool voltar aos 13 slots — assim medimos o ganho real.
