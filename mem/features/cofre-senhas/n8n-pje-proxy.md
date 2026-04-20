---
name: PJE MNI via n8n Proxy (mTLS)
description: A função testar-mni delega chamadas SOAP ao PJE para um proxy n8n na Hostinger que apresenta o certificado A1 (.pfx) no handshake mTLS, contornando bloqueio de IP de cloud e a limitação do Deno em client certificates.
type: feature
---
A Edge Function `testar-mni` NÃO chama mais o PJE diretamente. O fluxo é:

1. Decripta `senha_hash` e `certificado_a1_senha` (AES-GCM com `COFRE_ENCRYPTION_KEY`)
2. Baixa o `.pfx` do bucket Storage `certificados-a1` via `service_role`
3. Converte para base64 (chunked, evita stack overflow)
4. POST para `N8N_PJE_PROXY_URL` com header `X-Proxy-Token: $N8N_PJE_PROXY_TOKEN`
   Body: `{ endpoint, soap_action, soap_body, pfx_base64, pfx_password, timeout_ms }`
5. n8n executa `https.request` com `https.Agent({ pfx, passphrase })` — handshake mTLS real
6. Retorno: `{ status, body, elapsed_ms }` — Edge Function interpreta SOAP normalmente

**Por que precisa de proxy:**
- Deno (runtime das Edge Functions) não suporta client certificates em `fetch`
- IPs de cloud (Supabase/AWS/GCP) são bloqueados por TST/TRTs
- VPS Hostinger tem IP fixo "limpo" + Node nativo com mTLS

**Timeouts:** 30s no n8n, 35s na Edge Function (margem de 5s).

**Tipos de erro retornados:** `proxy_nao_configurado`, `proxy_unreachable`, `cert_storage_erro`, `credencial_invalida`, `erro_conexao`.

Resposta inclui `via_proxy: true` e `proxy_latencia_ms` para diagnóstico.
