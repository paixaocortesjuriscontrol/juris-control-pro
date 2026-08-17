# Teste das VPS "mortas" — resultado e correção

## O que o teste mostrou (feito agora)

DNS de todas as 12 VMs bate exatamente com os IPs do painel do Google — nenhuma VM trocou de IP.

| VPS (pool) | VM Google | Situação real |
|---|---|---|
| Google VPS 1 (`djen-google`) | vm01 · 35.247.201.135 | **Proxy VIVO e saudável** (uptime 81 dias) — mas o **certificado TLS expirou em 23/07/2026** |
| Google VPS 2.1 (`djen-google2:8443`) | vm02 · 34.39.217.255 | **Proxy VIVO e saudável** (uptime 114 dias) — **certificado TLS expirou em 24/07/2026** |
| Google VPS 9 (`djen-google9`) | vm09 · 34.39.248.189 | VM ligada, mas **nada escutando** em 443, 80, 8080 nem 8443 — sem handshake TLS |
| Google VPS 6 (referência) | vm06 · 34.95.247.67 | OK, `/health` 200 em 0,8s |

Provas:
- `curl` normal nas VPS 1 e 2.1: `SSL certificate has expired`.
- `curl -k` (ignorando certificado) nas mesmas: `{"ok":true,"service":"djen-vps-proxy",...}` → o serviço está de pé.
- VPS 9: `Could not connect to server` em todas as portas testadas.

Conclusão: as VPS 1 e 2.1 não estão mortas — o daemon as descarta porque o `fetch` do Node **rejeita certificado expirado**. Isso explica parte das 1.387 falhas de hoje: cada sorteio nesses dois slots falha na hora, e a VPS 9 (fora do ar de fato) queima uma terceira fatia do pool. O paralelismo real caiu de 13 para 10.

## Correção proposta

### 1. Renovar os certificados (VPS 1 e 2.1) — resolve 2 de 3
Renovar o Let's Encrypt nas duas VMs e reativar a renovação automática (o `certbot renew`/timer claramente parou de rodar em julho). Feito isso, os dois slots voltam ao pool sem nenhuma mudança de código.

### 2. Religar o serviço na VPS 9
Nada escuta na porta 443 da vm09: subir o proxy novamente e conferir a regra de firewall da VPS. Enquanto não voltar, desabilitar o slot no `djen_proxy_pool` para o daemon parar de sortear.

### 3. Blindar o pool contra este cenário
- Health-check periódico gravando o resultado no `djen_proxy_pool` (última checagem, último erro, latência), com **motivo explícito** — "certificado expirado" é diferente de "fora do ar" e hoje ambos aparecem apenas como `fetch failed`.
- Alerta quando um certificado estiver a menos de 15 dias do vencimento.
- Exibir a saúde do pool na tela (Pool de Proxies DJEN): status, latência e motivo da falha por slot.

### 4. Timeouts (item já mapeado antes)
Separar o timeout por requisição (~40s) do orçamento por unidade (~120s) para que uma página lenta gere retry em outra VPS em vez de queimar a unidade inteira.

## Detalhes técnicos
- Arquivos: `monitor-servidor/proxyPool.js` (health/cooldown, `DJEN_PROXY_TIMEOUT_MS`), `monitor-servidor/engines/paralela.js` (`PARALELA_UNIT_BUDGET_MS`), `src/components/configuracoes/PoolProxyDjenCard.tsx` (visão de saúde).
- Renovação de certificado e restart de serviço são feitos **nas VMs do Google via SSH** — fora do preview Lovable; posso entregar os comandos exatos.
- Alternativa de contorno rápido (não recomendada como definitiva): permitir certificado inválido apenas para slots marcados, o que reduz a segurança do canal — prefiro renovar.

## Fora de escopo
Nenhuma mudança na validação parte/advogado nem na persistência em `publicacoes_djen`.
