# PJE mTLS Proxy — deploy mais simples possível

Proxy minúsculo (1 arquivo, **zero dependências npm**) que recebe um POST, monta o handshake mTLS com o certificado A1 e devolve a resposta SOAP do PJE.

Roda na sua VPS Hostinger **lado a lado com o n8n**, sem encostar nele.

---

## 1) Suba os arquivos na Hostinger

Via SSH (ou File Manager), crie a pasta e copie `server.js` e `package.json`:

```bash
mkdir -p ~/pje-proxy
cd ~/pje-proxy
# cole server.js e package.json aqui (scp / nano / vim)
```

Não precisa rodar `npm install` — o servidor usa só módulos nativos do Node (`http`, `https`, `url`).

---

## 2) Gere um token forte

```bash
openssl rand -hex 32
```

Guarde a saída — vai ser o `PROXY_TOKEN`.

---

## 3) Suba com PM2 (já vem instalado na maioria dos planos Hostinger Node)

```bash
cd ~/pje-proxy
PROXY_TOKEN="cole_o_token_aqui" PORT=8088 pm2 start server.js --name pje-proxy
pm2 save
pm2 startup    # rode o comando que ele imprimir, para subir no boot
```

Confira:

```bash
curl http://127.0.0.1:8088/health
# {"ok":true,"service":"pje-mtls-proxy","uptime_s":3}
```

> O servidor escuta apenas em `127.0.0.1` por segurança. Ninguém da internet acessa direto.

---

## 4) Exponha pelo Nginx (mesmo domínio do n8n, subpath `/pje-proxy/`)

Edite o site do n8n no Nginx (ex: `/etc/nginx/sites-available/n8n.conf`) e **adicione um bloco `location` antes** do bloco do n8n:

```nginx
location /pje-proxy/ {
    proxy_pass http://127.0.0.1:8088/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 60s;
    client_max_body_size 25m;
}
```

Recarregue:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Teste de fora:

```bash
curl https://n8n.seudominio.com.br/pje-proxy/health
```

Pronto — você tem um endpoint HTTPS pronto:

```
POST  https://n8n.seudominio.com.br/pje-proxy/pje-mni
Header X-Proxy-Token: <seu token>
```

---

## 5) Configure os 2 secrets no Lovable Cloud

- `N8N_PJE_PROXY_URL` → `https://n8n.seudominio.com.br/pje-proxy/pje-mni`
- `N8N_PJE_PROXY_TOKEN` → o token gerado no passo 2

(Os nomes mantêm `N8N_` por compatibilidade com a Edge Function existente.)

---

## 6) Como atualizar / parar / ver logs

```bash
pm2 logs pje-proxy        # logs ao vivo
pm2 restart pje-proxy     # reiniciar
pm2 stop pje-proxy        # parar
pm2 delete pje-proxy      # remover
```

---

## API

### `GET /health`
Retorna `{ ok: true, ... }` — útil para uptime check.

### `POST /pje-mni`

**Headers:**
- `Content-Type: application/json`
- `X-Proxy-Token: <PROXY_TOKEN>`

**Body:**
```json
{
  "endpoint": "https://pje.tst.jus.br/pje-integracao-api/mni300/intercomunicacao",
  "soap_action": "consultarAvisosPendentes",
  "soap_body": "<soapenv:Envelope>...</soapenv:Envelope>",
  "pfx_base64": "MIIK...",
  "pfx_password": "senha_do_certificado",
  "timeout_ms": 30000
}
```

**Resposta (sucesso):**
```json
{
  "status": 200,
  "headers": { ... },
  "body": "<soap:Envelope>...</soap:Envelope>",
  "elapsed_ms": 1842
}
```

**Resposta (erro de upstream):**
```json
{
  "error": "upstream_error",
  "code": "ETIMEDOUT",
  "message": "...",
  "elapsed_ms": 30000
}
```

---

## Por que esse é o jeito mais fácil

- **1 arquivo**, sem `npm install`
- **Não toca no n8n** — ele continua na 5678 igualzinho
- **Reaproveita o domínio + SSL** que você já tem
- **PM2** cuida de subir junto com a VPS
- Se algo der errado, `pm2 logs pje-proxy` mostra tudo