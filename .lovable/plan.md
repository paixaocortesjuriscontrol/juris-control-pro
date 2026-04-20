

# Plano: Acesso ao PJE-TST via Cofre de Senhas usando n8n (Hostinger) como Proxy mTLS

## Por que estamos sendo bloqueados hoje

A Edge Function `testar-mni` faz a chamada SOAP direto do runtime Deno do Supabase. Isso falha por **dois motivos combinados**:

1. **Bloqueio de IP**: O TST e demais tribunais bloqueiam faixas de IP de cloud (Supabase/AWS/GCP). Toda chamada cai em `403`/`timeout`/`reset`.
2. **Falta de mTLS**: O PJE-TST exige autenticação mútua TLS apresentando o **certificado A1 (.pfx)** do advogado no handshake. O Deno das Edge Functions não suporta `client certificates` nativamente — então mesmo se o IP passasse, o servidor recusaria a conexão.

A sua VPS Hostinger com n8n resolve os dois problemas: tem IP fixo "limpo" e o Node.js (que roda dentro do n8n) suporta mTLS nativo via `https.Agent({ pfx, passphrase })`.

## Arquitetura proposta

```text
[App Lovable]
     │  invoke('testar-mni', { cofre_senha_id })
     ▼
[Edge Function testar-mni]
     │ 1. Valida JWT do usuário
     │ 2. Decripta senha + senha do .pfx (AES-GCM)
     │ 3. Baixa o .pfx do Storage do Supabase
     │ 4. POST → n8n webhook (com PROXY_TOKEN)
     ▼
[n8n na Hostinger] ── Webhook "pje-mni-proxy"
     │ a. Valida X-Proxy-Token
     │ b. Monta envelope SOAP consultarAvisosPendentes
     │ c. HTTP Request com mTLS (pfx em base64 + senha)
     ▼
[pje.tst.jus.br/pje-integracao-api/mni300/intercomunicacao]
     │
     ▼ resposta SOAP
[n8n] devolve { http_status, body, elapsed_ms }
     ▼
[Edge Function] interpreta SOAP, atualiza cofre_senhas e retorna ao front
```

## Etapas de implementação

### 1. Workflow n8n na Hostinger
Criar um workflow `pje-mni-proxy` com 3 nós:

- **Webhook** (POST, path `/webhook/pje-mni-proxy`, Header Auth)
  Body esperado:
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
- **Code** (JavaScript) — monta `https.Agent` com `pfx: Buffer.from(pfx_base64,'base64')` e faz a request com `axios`/`fetch` Node, retornando `{status, headers, body, elapsed_ms}`.
- **Respond to Webhook** — devolve o JSON.

Variáveis de ambiente no n8n: `PROXY_TOKEN` (gerado, ~32 chars random).

### 2. Secrets no Supabase (Lovable Cloud)
- `N8N_PJE_PROXY_URL` → `https://seu-n8n.hostinger.com/webhook/pje-mni-proxy`
- `N8N_PJE_PROXY_TOKEN` → mesmo valor configurado no n8n
- (Já existe) `COFRE_ENCRYPTION_KEY` para decriptar A1+senha

### 3. Refatorar Edge Function `testar-mni`
Em vez de chamar `pje.tst.jus.br` direto:
- Buscar `certificado_a1_path` da credencial → baixar do Storage Supabase
- Decriptar `senha_hash` e `certificado_a1_senha`
- Converter o .pfx para base64
- POST para `N8N_PJE_PROXY_URL` com header `X-Proxy-Token`
- Interpretar resposta SOAP (faultstring, `consultarAvisosPendentesResponse`)
- Atualizar `cofre_senhas.status_validacao` / `tentativas_falhas` / `bloqueado_ate` (lógica já existente é mantida)

### 4. UI do Cofre de Senhas
Sem mudança visual. O botão "Testar MNI" passa a funcionar no TST. Acrescentar no resultado:
- `via_proxy: true`
- `proxy_latencia_ms` para diagnóstico

### 5. Tratamento de erros padronizado
Mapear códigos retornados pelo n8n:
- `proxy_unreachable` → "Proxy n8n offline — verifique a VPS"
- `cert_invalid` → "Certificado A1 inválido ou expirado"
- `cert_password_wrong` → "Senha do certificado incorreta"
- `auth_failed` (faultstring com 'autenticação') → "CPF/Senha do PJE incorretos"
- `tribunal_indisponivel` → erro 5xx do TST

## Detalhes técnicos

- **Storage do .pfx**: o campo `certificado_a1_path` aponta para um arquivo no bucket Supabase. A Edge Function usa `service_role` para `download()`.
- **Tamanho do payload**: A1 típico tem 4–8KB → base64 ~10KB. Confortável para webhook.
- **Segurança do proxy**: o n8n só aceita requests com `X-Proxy-Token` válido; recomendo também restringir o webhook por IP (firewall Hostinger → permitir somente faixas Supabase Edge ou tornar `N8N_PJE_PROXY_TOKEN` longo e rotacioná-lo).
- **Timeout**: 30s no n8n, 35s na Edge Function (margem).
- **Logs**: gravados em `historico_capturas` (já existe) com `detalhes.proxy_used = 'n8n-hostinger'`.
- **Escopo inicial**: só TST. Demais TRTs continuam mostrando "Endpoint MNI não configurado" — habilitamos depois reutilizando o mesmo proxy (só adiciona URL no `MNI_ENDPOINTS`).

## O que você precisa preparar antes de eu codar

1. URL pública do seu n8n na Hostinger (ex: `https://n8n.seudominio.com.br`).
2. Confirmar que o n8n está acessível por HTTPS (TLS válido — Let's Encrypt já basta).
3. Decidir o `PROXY_TOKEN` (eu gero um se preferir).
4. Confirmar que o certificado A1 do TST já está cadastrado no Cofre de uma credencial de teste.

## Arquivos que serão alterados

- `supabase/functions/testar-mni/index.ts` — refatorado para usar proxy
- Novo: documentação `mem://features/cofre-senhas/n8n-pje-proxy.md`
- Adicionar 2 secrets via tool de secrets

Sem mudanças no schema do banco. Sem mudanças na UI além de mensagens de erro mais claras.

