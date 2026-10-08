---
name: Busca direta PJe com certificado A1
description: Minhas credenciais PJe aceita CPF+senha e/ou certificado A1 (.pfx/.p12); o certificado vai no handshake mTLS do proxy, CPF+senha continuam no corpo SOAP.
type: feature
---
A tela `/credenciais-pje` (buscar-pje-direto) aceita duas formas de acesso ao PJe:

- **CPF + senha** (obrigatório sempre — o MNI exige idConsultante/senhaConsultante no corpo SOAP mesmo com certificado).
- **Certificado A1 opcional**: arquivo .pfx/.p12 enviado na tela, guardado no bucket privado `certificados-a1` em `pje-direto/{user_id}.pfx`; senha do certificado cifrada com AES-GCM (`COFRE_ENCRYPTION_KEY`) em `credenciais_pje_usuario.certificado_senha_cifrada`. Colunas: `certificado_path`, `certificado_nome`, `certificado_senha_cifrada`.

Na busca, `carregarPfx()` baixa o .pfx do storage e envia `pfx_base64`/`pfx_password` ao proxy n8n (`N8N_PJE_PROXY_URL`), que faz o handshake mTLS — mesmo padrão do `testar-mni`.

**Token A3 (USB/cartão) NÃO é automatizável**: o sistema não consegue usar; quem tem A3 usa CPF+senha quando o tribunal aceita.
