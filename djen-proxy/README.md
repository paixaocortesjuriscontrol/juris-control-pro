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

    # CORS — necessário para o navegador chamar direto
    add_header Access-Control-Allow-Origin  "*" always;
    add_header Access-Control-Allow-Headers "content-type, x-proxy-token" always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    if ($request_method = OPTIONS) { return 204; }
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

## Por que essa POC

- **1 arquivo**, sem `npm install`
- **Não toca em nada** que já esteja rodando na VPS
- **Usa o domínio + SSL** que você já tem
- Se sair do ar, o app cai pra chamada direta automaticamente (fallback no cliente)