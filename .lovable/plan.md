# Finalizar reparo das VPS do pool DJEN

## Onde estamos agora (testado de fora, agora)

| VPS | Domínio | Certificado | `/health` |
|---|---|---|---|
| Google VPS 1 (vm01) | djen-google.juriscontrol.adv.br | Renovado, válido até 15/11/2026 | **200 OK** — resolvido |
| Google VPS 2.1 (vm02) | djen-google2.juriscontrol.adv.br:8443 | Arquivo renovado até 15/11/2026, mas a porta 8443 **ainda entrega o certificado antigo** (venceu 24/07/2026) | Recusado por certificado expirado |
| Google VPS 9 (vm09) | djen-google9.juriscontrol.adv.br | Não testável | **Nada escutando** em 443, 8443, 80 nem 8080 |

Duas observações importantes da vm02:

1. O proxy da vm02 atende em **8443**, não em 443 (a 443 é o Nginx, que devolve 404 em `/health`).
2. O processo da 8443 carregou o certificado antigo na memória e ainda não foi reiniciado. O `pm2 list` apareceu vazio para o usuário `contato`, então esse serviço roda por outro caminho (systemd ou outro usuário) — é isso que precisa ser identificado.

## Etapa 1 — vm02: descobrir quem escuta na 8443 e reiniciar

```bash
sudo ss -tlnp | grep 8443
```

A saída mostra o processo. Conforme o caso:

```bash
# se for um serviço systemd (ex.: djen-proxy.service):
sudo systemctl restart NOME_DO_SERVICO
sudo systemctl status NOME_DO_SERVICO --no-pager

# se for PM2 rodando como root:
sudo pm2 list
sudo pm2 restart all

# se for PM2 de outro usuário (ex.: root ou djen):
sudo -u USUARIO pm2 list
sudo -u USUARIO pm2 restart all
```

## Etapa 2 — vm02: validar

```bash
curl -s https://djen-google2.juriscontrol.adv.br:8443/health

echo | openssl s_client -connect djen-google2.juriscontrol.adv.br:8443 \
  -servername djen-google2.juriscontrol.adv.br 2>/dev/null \
  | openssl x509 -noout -dates
```

Precisa retornar `{"ok":true,...}` e `notAfter=Nov 15 ... 2026`. Se ainda vier a data de julho, o processo não foi reiniciado de fato.

## Etapa 3 — vm09: religar o serviço

```bash
sudo ss -tlnp | grep -E ':443 |:8443 |:80 '
sudo systemctl list-units --type=service | grep -i djen
pm2 list
sudo pm2 list
```

Se houver serviço parado, subir e habilitar no boot:

```bash
sudo systemctl enable --now NOME_DO_SERVICO
# ou, se for PM2:
pm2 resurrect && pm2 save
```

Se nada existir, instalar do zero:

```bash
ls -la ~/djen-proxy/
cd ~/djen-proxy && bash setup.sh
```

Conferir o certificado da vm09 e renovar se preciso (é o mesmo padrão da vm02, sempre com o domínio próprio):

```bash
sudo certbot certificates
sudo certbot --nginx \
  --cert-name djen-google9.juriscontrol.adv.br \
  -d djen-google9.juriscontrol.adv.br \
  --force-renewal --non-interactive --agree-tos
```

Verificar também a regra de firewall da VPC liberando a porta usada pelo proxy.

## Etapa 4 — Religar a renovação automática (vm01, vm02 e vm09)

O certbot já reagendou a renovação sozinho, mas falta o passo que quebrou em julho: **reiniciar o serviço do proxy após cada renovação**. Sem isso, o arquivo é renovado e o processo continua servindo o certificado velho — exatamente o que aconteceu na vm02.

Em cada VM, criar um script de hook de deploy do Let's Encrypt (pasta `renewal-hooks/deploy/`) que recarrega o Nginx quando ativo e reinicia o serviço/PM2 do proxy, marcá-lo como executável e validar:

```bash
sudo systemctl list-timers | grep -i certbot
sudo certbot renew --dry-run
```

O `--dry-run` precisa passar em todas. Entrego o conteúdo exato do script assim que a Etapa 1 revelar como o proxy roda em cada VM.

## Etapa 5 — Validar o pool dentro do app

1. Em **Configurações → Pool de Proxies DJEN**, reative o slot "Google VPS 9" depois que ele responder de fora.
2. Clique em **Testar agora** nos três slots.
3. Os selos devem ficar verdes, com latência e `cert_expira_em` em 15/11/2026.

O monitor diário `verificar-saude-pool-djen` (8h BRT) grava `saude_status`, `saude_motivo`, `latencia_ms` e `cert_expira_em`, e avisa por e-mail a 30, 15, 7 e 1 dia do vencimento.

## Regra a manter

Nunca usar o domínio de uma VM em outra: `djen-google` → vm01 (35.247.201.135), `djen-google2` → vm02 (34.39.217.255), `djen-google9` → vm09 (34.39.248.189). Foi essa troca que gerou o 404 do primeiro erro.

## Fora de escopo

Ajuste de timeout/orçamento do motor paralelo (`DJEN_PROXY_TIMEOUT_MS` / `PARALELA_UNIT_BUDGET_MS`) fica para depois que o pool voltar aos 13 slots — assim medimos o ganho real.
