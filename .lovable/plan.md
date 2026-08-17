# Arrumar as VPS do pool DJEN + aviso de certificado vencendo

## Diagnóstico confirmado no teste

DNS das 12 VMs bate exatamente com os IPs do painel do Google — nenhuma trocou de IP.

| VPS (pool) | VM Google | Situação real |
|---|---|---|
| Google VPS 1 (`djen-google`) | vm01 · 35.247.201.135 | Proxy **vivo e saudável** (81 dias de uptime) — **certificado TLS expirou em 23/07/2026** |
| Google VPS 2.1 (`djen-google2:8443`) | vm02 · 34.39.217.255 | Proxy **vivo e saudável** (114 dias) — **certificado TLS expirou em 24/07/2026** |
| Google VPS 9 (`djen-google9`) | vm09 · 34.39.248.189 | VM ligada, mas **nada escutando** em 443 / 80 / 8080 / 8443 |
| Google VPS 6 (controle) | vm06 · 34.95.247.67 | OK — `/health` 200 em 0,8s |

Provas: `curl` normal nas VPS 1 e 2.1 devolve `SSL certificate has expired`; com `curl -k` as duas respondem `{"ok":true,"service":"djen-vps-proxy"...}`. A VPS 9 devolve `Could not connect` em todas as portas.

Ou seja: 2 das 3 "mortas" são só **certificado vencido** (a renovação automática parou em julho) e o `fetch` do Node rejeita a conexão. Isso derruba o pool de 13 para 10 slots e alimenta as falhas de hoje.

## Etapa 1 — Arrumar as VPS (feito por SSH nas VMs, fora do preview)

Entrego o roteiro pronto para colar no SSH de cada VM:

**vm01 e vm02 — renovar certificado e religar a renovação automática**
- Renovar o Let's Encrypt do domínio da VM.
- Reiniciar o serviço do proxy para carregar o novo par de chaves.
- Reativar/validar o timer de renovação (`systemctl list-timers` deve mostrar o certbot ativo) e adicionar o hook que reinicia o proxy após cada renovação — foi a ausência disso que travou em julho.
- Validar com `curl https://.../health` **sem** `-k`.

**vm09 — religar o serviço**
- Verificar se o processo do proxy está rodando e subir/habilitar no boot.
- Conferir a regra de firewall da VPC liberando a porta usada.
- Validar `/health` externamente.

Enquanto a vm09 não voltar, deixo o slot desabilitado no `djen_proxy_pool` para o daemon parar de sortear um destino morto (basta reativar depois).

## Etapa 2 — Ser avisado quando o certificado expirar

Monitor automático de saúde e de validade dos certificados:

- **Verificação diária** de cada slot do `djen_proxy_pool`: responde? em quanto tempo? e **quantos dias faltam para o certificado vencer**.
- O resultado fica gravado no próprio pool (última checagem, latência, dias restantes do certificado, motivo da falha) — com motivo **explícito**: "certificado expirado" deixa de virar um genérico `fetch failed`.
- **Alertas por e-mail** aos administradores:
  - certificado a **30, 15, 7 e 1 dia** do vencimento;
  - certificado **já vencido** ou VPS **fora do ar**, uma vez por dia enquanto o problema durar.
- **Na tela "Pool de Proxies DJEN"**: um selo por VPS — verde (ok), âmbar (certificado vencendo em ≤15 dias), vermelho (vencido ou offline) — com latência e data de expiração visíveis, e botão "Testar agora".

## Detalhes técnicos

- Nova Edge Function `verificar-saude-pool-djen`: faz `/health` em cada slot, lê a validade do certificado da conexão TLS, grava o resultado e dispara e-mail via Resend quando cruza os limites. Agendada 1x/dia por cron (`pg_cron` + `pg_net`).
- Migração no `djen_proxy_pool`: colunas `ultima_checagem_em`, `saude_status`, `saude_motivo`, `latencia_ms`, `cert_expira_em`, `ultimo_alerta_cert_em`.
- Frontend: `src/components/configuracoes/PoolProxyDjenCard.tsx` ganha os selos de saúde e o botão de teste manual.
- Renovação de certificado e restart de serviço são executados **nas VMs do Google via SSH** — não há como automatizar isso do Lovable; entrego os comandos exatos.

## Fora de escopo (por ora)
Ajuste de timeout/orçamento do motor paralelo (`DJEN_PROXY_TIMEOUT_MS` / `PARALELA_UNIT_BUDGET_MS`) fica para depois que o pool voltar aos 13 slots — assim medimos o ganho real.
