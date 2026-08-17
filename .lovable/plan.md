# Renovar certificados e restaurar VPS do pool DJEN

## Diagnóstico confirmado na vm01

O certificado é `djen-google.juriscontrol.adv.br`, vencido em 23/07/2026. A renovação falhou porque o certbot está configurado com o autenticador **webroot** e o desafio HTTP volta **404**:

```text
Invalid response from https://djen-google.juriscontrol.adv.br/.well-known/acme-challenge/... : 404
```

Quem responde nas portas 80/443 hoje (provavelmente o próprio proxy Node, não o Nginx) não serve mais o diretório `.well-known/`. Foi isso que travou a renovação automática em julho.

A saída é trocar o método de validação para **standalone**: o certbot sobe seu próprio servidor temporário na porta 80 e não depende de webroot configurado.

## Situação das VMs

| Slot | VM | IP | Domínio | Problema |
|---|---|---|---|---|
| Google VPS 1 | vm01 | 35.247.201.135 | djen-google.juriscontrol.adv.br | Certificado expirado 23/07/2026 · webroot com 404 |
| Google VPS 2.1 | vm02 | 34.39.217.255 | djen-google2.juriscontrol.adv.br | Certificado expirado 24/07/2026 (provável mesma causa) |
| Google VPS 9 | vm09 | 34.39.248.189 | djen-google9.juriscontrol.adv.br | Serviço do proxy offline |

## Etapa 1 — Descobrir quem ocupa a porta 80 (vm01)

```bash
sudo ss -tlnp | grep -E ':80 |:443 '
systemctl is-active nginx && echo "nginx ativo" || echo "nginx inativo"
pm2 list
```

O resultado decide se a renovação precisa parar o Nginx ou o PM2.

## Etapa 2 — Renovar com método standalone (vm01)

O ponto crítico é liberar a porta 80 durante a emissão. Os hooks abaixo fazem isso sozinhos.

**Se o Nginx está na porta 80:**

```bash
sudo certbot certonly --standalone \
  --cert-name djen-google.juriscontrol.adv.br \
  -d djen-google.juriscontrol.adv.br \
  --pre-hook "systemctl stop nginx" \
  --post-hook "systemctl start nginx" \
  --force-renewal --non-interactive --agree-tos
```

**Se é o proxy Node/PM2 que está na porta 80:**

```bash
sudo certbot certonly --standalone \
  --cert-name djen-google.juriscontrol.adv.br \
  -d djen-google.juriscontrol.adv.br \
  --pre-hook "su - contato -c 'pm2 stop all'" \
  --post-hook "su - contato -c 'pm2 start all'" \
  --force-renewal --non-interactive --agree-tos
```

Conferir a nova validade com `sudo certbot certificates` — deve mostrar `Expiry Date` ~90 dias à frente, sem `INVALID: EXPIRED`.

## Etapa 3 — Recarregar o serviço para carregar o novo par de chaves (vm01)

Renovar o arquivo não basta: o processo em execução mantém o certificado antigo em memória.

```bash
# se o Nginx faz o TLS:
sudo nginx -t && sudo systemctl reload nginx

# se o proxy Node faz o TLS:
pm2 restart all
```

Validar **sem** `-k`:

```bash
curl -s https://djen-google.juriscontrol.adv.br/health
# esperado: {"ok":true,"service":"djen-vps-proxy",...}

echo | openssl s_client -connect djen-google.juriscontrol.adv.br:443 2>/dev/null \
  | openssl x509 -noout -dates
```

## Etapa 4 — Deixar a renovação automática funcionando (vm01)

Faltavam duas coisas: um método de validação que funcione (resolvido na Etapa 2, que já grava `standalone` no arquivo de renovação) e o reload do serviço após cada renovação.

Crie um script de hook de deploy do Let's Encrypt (em `renewal-hooks/deploy/`) que recarregue o Nginx quando ativo e reinicie o PM2 quando existir, marque-o como executável, e confirme o agendamento:

```bash
sudo systemctl list-timers | grep -i certbot
sudo certbot renew --dry-run
```

O `--dry-run` precisa passar. Se falhar, a renovação automática continua quebrada. Entrego o conteúdo exato do script de hook na hora da execução.

## Etapa 5 — Repetir tudo na vm02

Mesmas Etapas 1 a 4, trocando o domínio. Rode `sudo certbot certificates` antes para confirmar o nome exato do certificado.

## Etapa 6 — Restaurar a vm09 (offline)

```bash
# Verificar se há processos do proxy rodando
pm2 list

# Se estiver parado, subir
pm2 resurrect

# Se não aparecer na lista, verificar se a pasta do proxy existe
ls -la ~/djen-proxy/

# Subir manualmente se necessário
cd ~/djen-proxy
bash setup.sh

# Verificar portas abertas
sudo ss -tlnp | grep -E '443|80|8080|8443'

# Testar health local
curl -s http://127.0.0.1:8089/health
# ou na porta externa
# curl -s https://$(hostname -f)/health
```

Se o firewall da VPC estiver bloqueando, verifique no Google Cloud Console: VPC network → Firewall → regra liberando a porta usada (geralmente 443/tcp e 80/tcp).
Se o certificado da vm09 também estiver vencido, aplique as Etapas 2 a 4 nela.

## Etapa 7 — Reabilitar a vm09 e validar o pool no app

1. Quando a vm09 responder `/health` externamente, vá em **Configurações → Pool de Proxies DJEN** e reative o slot "Google VPS 9".
2. Clique em **Testar agora** nos três slots reparados.
3. Os selos devem ficar verdes, com latência e `cert_expira_em` ~90 dias à frente.

A Edge Function `verificar-saude-pool-djen` já está rodando diariamente às 8h BRT e gravando:

- `ultima_checagem_em`
- `saude_status` (ok / atencao / critico)
- `saude_motivo` (ex: "certificado expirado")
- `latencia_ms`
- `cert_expira_em`

Após reparar as VMs, abra **Configurações → Pool de Proxies DJEN** no dia seguinte ou clique em **Testar agora** em cada slot para confirmar que os selos ficam verdes.

## Fora de escopo

Ajuste de timeout/orçamento do motor paralelo (`DJEN_PROXY_TIMEOUT_MS` / `PARALELA_UNIT_BUDGET_MS`) fica para depois que o pool voltar aos 13 slots — assim medimos o ganho real.
