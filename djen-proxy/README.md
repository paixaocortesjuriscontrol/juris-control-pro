# DJEN Comunica Proxy — POC

Proxy minúsculo (1 arquivo, **zero dependências npm**) que repassa GETs para a API
`https://comunicaapi.pje.jus.br/api/v1/comunicacao` saindo do IP da sua VPS.

Objetivo: dar um **IP "limpo"** ao motor "DJEN Termos Paralela" e reduzir os erros
`429 Too Many Attempts` que aparecem quando todas as workers paralelas saem do
mesmo IP do navegador.

Roda lado a lado com qualquer outra coisa que você já tenha na VPS (n8n, pje-proxy, etc.).

---

## 1) Suba os arquivos

Via SSH (ou File Manager), copie a pasta `djen-proxy/` inteira para o seu home:

```bash
# da sua máquina local
scp -r djen-proxy/ usuario@SEU_IP:~/
```

---

## 2) Rode o setup

```bash
cd ~/djen-proxy
bash setup.sh
```

O script:
- valida Node 18+ e instala PM2 se faltar
- gera (ou reaproveita) um `PROXY_TOKEN`
- sobe o servidor na porta **8089** (apenas em `127.0.0.1`)
- registra no PM2 e configura para subir no boot

No final ele imprime o token. Guarde — você vai usar na UI do app.

Confira:

```bash
curl http://127.0.0.1:8089/health
# {"ok":true,"service":"djen-comunica-proxy","uptime_s":3,"ip":"185.xxx.xxx.xxx"}
```

---

## 3) Exponha pelo Nginx no subpath `/djen-proxy/`

Edite o site que você já usa no Nginx (ex: `/etc/nginx/sites-available/seu-site.conf`)
e **adicione um bloco `location` antes** dos demais:

```nginx
location /djen-proxy/ {
    proxy_pass http://127.0.0.1:8089/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 120s;
    client_max_body_size 25m;

    # Não trate CORS/OPTIONS aqui: o server.js já responde /health, /djen e OPTIONS
    # com os headers corretos. Se o Nginx interceptar OPTIONS, o navegador bloqueia
    # chamadas reais com X-Proxy-Token antes do GET chegar ao Node.
}
```

Recarregue:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Teste de fora:

```bash
curl https://SEU_DOMINIO/djen-proxy/health
```

Teste também o preflight usado pelo navegador na chamada real:

```bash
curl -i -X OPTIONS https://SEU_DOMINIO/djen-proxy/djen \
  -H "Origin: https://juriscontrol.adv.br" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: x-proxy-token"
# Deve retornar Access-Control-Allow-Origin e Access-Control-Allow-Headers
```

---

## 4) Cadastre na UI

Em **Configurações → Pool de Proxies DJEN (POC)**:

- **Label:** Hostinger #1
- **URL base:** `https://SEU_DOMINIO/djen-proxy`
- **Token:** o `PROXY_TOKEN` impresso no setup

Clique em **Testar e salvar**. Depois ative o toggle global.

Pronto — a próxima execução de "DJEN Termos Paralela" vai alternar entre chamada
direta e VPS em round-robin.

---

## API

### `GET /health`

Retorna `{ ok: true, ip: "...", uptime_s: ... }` — útil para health-check.

### `GET /djen?<query>`

Headers obrigatórios:
- `X-Proxy-Token: <PROXY_TOKEN>`

Repassa todos os query params recebidos para o upstream
`https://comunicaapi.pje.jus.br/api/v1/comunicacao?<query>` e devolve:

```json
{
  "status": 200,
  "body": "<corpo cru retornado pelo upstream, em string>",
  "elapsed_ms": 842
}
```

Em caso de erro de upstream:

```json
{
  "error": "upstream_error",
  "code": "ETIMEDOUT",
  "message": "...",
  "elapsed_ms": 90000
}
```

---

## Operação

```bash
pm2 logs djen-proxy        # logs ao vivo
pm2 restart djen-proxy     # reiniciar
pm2 stop djen-proxy        # parar
pm2 delete djen-proxy      # remover
```

Para atualizar: copie o novo `server.js` por cima e rode `pm2 restart djen-proxy`.

---

## Auto-renovação do certificado TLS (obrigatório nas VMs do pool)

Nas VMs que servem HTTPS direto (Google vm01, vm02, vm09), o certificado do
Let's Encrypt vence a cada 90 dias. O certbot renova sozinho, mas o proxy **não
recarrega** o certificado novo sem um restart — foi exatamente isso que derrubou
o pool em julho/2026.

Rode **uma vez em cada VM**, como root:

```bash
curl -fsSL https://juriscontrol.adv.br/scripts/instalar-auto-renovacao-cert.sh -o /tmp/renov.sh
sudo bash /tmp/renov.sh
```

Se precisar forçar os valores (o script detecta sozinho):

```bash
sudo DOMINIO=djen-google2.juriscontrol.adv.br PORTA=8443 SERVICO=djen-proxy \
  bash /tmp/renov.sh
```

O que ele faz:

1. Ativa o timer do certbot (`certbot.timer`); se não existir, cria um cron de segurança.
2. Ajusta grupo `letsencrypt` + permissões em `live/` e `archive/`, para o proxy
   não-root conseguir ler a chave nova.
3. Instala o hook `/etc/letsencrypt/renewal-hooks/deploy/99-reload-djen-proxy.sh`,
   que após cada renovação reaplica permissões, recarrega o Nginx (se ativo) e
   reinicia `djen-proxy.service`.
4. Roda `certbot renew --dry-run` e **falha ruidosamente** se a simulação não passar.
5. Mostra `notBefore`/`notAfter` servidos na porta do proxy e o status do serviço.

É idempotente — pode rodar de novo sem duplicar nada.

Conferências depois:

```bash
sudo systemctl list-timers | grep -i certbot   # renovação agendada
sudo tail -20 /var/log/djen-cert-renew.log     # histórico de reloads
echo | openssl s_client -connect djen-google2.juriscontrol.adv.br:8443 \
  -servername djen-google2.juriscontrol.adv.br 2>/dev/null \
  | openssl x509 -noout -dates                 # validade servida de fora
```

Rede de segurança no app: o monitor `verificar-saude-pool-djen` roda todo dia às
8h BRT, grava `saude_status` / `cert_expira_em` em `djen_proxy_pool` e avisa por
e-mail a 30, 15, 7 e 1 dia do vencimento — se alguma renovação falhar, você
descobre antes de o pool cair.

---

## Por que essa POC

- **1 arquivo**, sem `npm install`
- **Não toca em nada** que já esteja rodando na VPS
- **Usa o domínio + SSL** que você já tem
- Se sair do ar, o app cai pra chamada direta automaticamente (fallback no cliente)