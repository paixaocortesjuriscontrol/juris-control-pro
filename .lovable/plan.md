# Renovar certificados e restaurar VPS do pool DJEN

## Contexto

Você acessa as VMs pelo botão SSH do Google Cloud Console, então não precisa de chave `.pem` local. O acesso é feito diretamente pelo navegador no painel da VM.

## Situação das VMs

| Slot | VM | IP | DNS | Problema |
|---|---|---|---|---|
| Google VPS 1 | vm01 | 35.247.201.135 | djentermosvm01 | Certificado TLS expirado em 23/07/2026 |
| Google VPS 2.1 | vm02 | 34.39.217.255 | (ver painel) | Certificado TLS expirado em 24/07/2026 |
| Google VPS 9 | vm09 | 34.39.248.189 | (ver painel) | Serviço do proxy offline / nenhuma porta respondendo |

## Etapa 1 — Acessar cada VM pelo Google Cloud Console

1. Abra o Google Cloud Console → Compute Engine → Instâncias de VM.
2. Localize a instância (vm01, vm02, vm09).
3. Clique no botão **SSH** da linha da instância (abre terminal no navegador).

## Etapa 2 — Renovar certificado e reiniciar serviço (vm01 e vm02)

Rode, na ordem, em cada uma das duas VMs com certificado vencido:

```bash
# 1) Verificar se o certbot está instalado e qual domínio está configurado
sudo certbot certificates

# 2) Renovar à força o certificado do domínio da VM
sudo certbot renew --force-renewal

# 3) Verificar se a renovação criou novos arquivos
sudo ls -la /etc/letsencrypt/live/

# 4) Reiniciar o serviço que expõe o proxy
# Se usar Nginx:
sudo systemctl reload nginx
# Ou, se o proxy está sob PM2:
pm2 restart all

# 5) Verificar saúde sem ignorar SSL
curl -s https://$(hostname -f)/health
# Deve retornar {"ok":true,...}

# 6) Verificar data de validade do novo certificado
echo | openssl s_client -connect $(hostname -f):443 2>/dev/null | openssl x509 -noout -dates
```

## Etapa 3 — Configurar renovação automática com hook de reload (vm01 e vm02)

Ainda em cada VM com certificado, para evitar que volte a vencer no futuro:

```bash
# Criar hook de deploy que recarrega o serviço após cada renovação
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-proxy.sh <<'EOF'
#!/bin/bash
set -e
# Recarrega Nginx se estiver ativo
if systemctl is-active --quiet nginx; then
  systemctl reload nginx
fi
# Reinicia o proxy Node/PM2 se estiver rodando
if command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "djen-proxy\|djen"; then
  pm2 restart all
fi
EOF

sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-proxy.sh

# Confirmar que o timer do certbot está ativo
sudo systemctl list-timers | grep certbot
```

## Etapa 4 — Restaurar VM 09 (offline)

Na VM 09:

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

## Etapa 5 — Testar as três VMs de fora

No Cloud Shell ou no seu terminal local:

```bash
# vm01
curl -s https://djentermosvm01.???/health
# ou
curl -s https://35.247.201.135/health -k

# vm02
curl -s https://34.39.217.255/health -k

# vm09
curl -s https://34.39.248.189/health -k
```

Substitua `djentermosvm01.???` pelo domínio real da VM (você pode descobrir com `hostname -f` dentro do SSH do Google).

## Etapa 6 — Reabilitar VM 09 no pool do app

Quando a VM 09 voltar a responder `/health` com `ok:true`, reative o slot no app:

1. Acesse **Configurações → Pool de Proxies DJEN**.
2. Localize o slot "Google VPS 9".
3. Ligue o toggle/ative.
4. Clique em **Testar agora**.

## Etapa 7 — Validar o monitor automático

A Edge Function `verificar-saude-pool-djen` já está rodando diariamente às 8h BRT e gravando:

- `ultima_checagem_em`
- `saude_status` (ok / atencao / critico)
- `saude_motivo` (ex: "certificado expirado")
- `latencia_ms`
- `cert_expira_em`

Após reparar as VMs, abra **Configurações → Pool de Proxies DJEN** no dia seguinte ou clique em **Testar agora** em cada slot para confirmar que os selos ficam verdes.

## Fora de escopo

Ajuste de timeout/orçamento do motor paralelo (`DJEN_PROXY_TIMEOUT_MS` / `PARALELA_UNIT_BUDGET_MS`) fica para depois que o pool voltar aos 13 slots — assim medimos o ganho real.
