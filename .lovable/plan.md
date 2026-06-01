# Google VPS 1 com 5 IPs — piloto, configurável na tela, sem parar consultas

## Escopo
- Piloto **só na Google VPS 1**. As outras VPSs (Hostinger, Google 2.1, 3, 4, 5) ficam como estão.
- **Total 5 IPs** nessa VPS: 1 IP já existente + 4 IPs estáticos novos.
- Você escolhe na tela quais paths/IPs entram no Pool (cada IP vira um slot independente do round-robin).
- **Zero downtime** na DJEN Termos Paralela: PM2 reload graceful, fallback automático, slots novos entram a quente.

## Como vai ficar a tela
Na linha "Google VPS 1" do Pool aparece:

```text
✓  Google VPS 1   [IP 35.198.10.42]   [+ Multi-IP]   [toggle ⟳ 🗑]
```

- Chip "IP …": IP público real, via `/whoami`, cache 5 min, revalida no ⟳.
- "+ Multi-IP" abre um diálogo:
  ```text
  Google VPS 1 — IPs adicionais
  ├─ /proxy/2  →  IP detectado: 35.198.10.43   [salvar como slot]
  ├─ /proxy/3  →  IP detectado: 35.198.10.44   [salvar como slot]
  ├─ /proxy/4  →  IP detectado: 35.198.10.45   [salvar como slot]
  └─ /proxy/5  →  IP detectado: 35.198.10.46   [salvar como slot]
  ```
  Cada "salvar como slot" cria uma linha nova no Pool (`Google VPS 1 — IP 2/3/4/5`) com a mesma `baseUrl` + path + mesmo token. Entra no round-robin no próximo request.
- Botão só aparece se `/whoami` responder (sinal de que o `server.js` novo está rodando). Sem isso, a tela fica idêntica à atual.

## Garantia de zero downtime
- O round-robin lê os slots a cada chamada (não trava no início da execução).
- `pm2 reload djen-proxy` é graceful: requisições em voo terminam, novas usam a nova versão.
- Outros slots (Hostinger + Google 2.1..5) continuam atendendo durante o reload.
- Se algo falhar no reload, `LOCAL_IPS` ausente faz o `server.js` cair em modo legado (single-IP igual hoje).
- Adicionar slot no Pool = `INSERT` em `djen_proxy_pool`, sem afetar slots existentes.

## Ordem de execução (você roda, eu deixo tudo pronto)
```text
1. Reservar 4 IPs estáticos em southamerica-east1  (sem efeito no app)
2. Anexar 4 access-configs adicionais em nic0 da VM Google VPS 1
3. Editar ~/djen-proxy/.env: LOCAL_IPS=IP1,IP2,IP3,IP4,IP5
4. pm2 reload djen-proxy                          (graceful, sem queda)
5. curl https://djen-google.juriscontrol.adv.br/whoami/2  (valida)
6. Na tela do Pool, "+ Multi-IP" em Google VPS 1, salvar /proxy/2..5
   → round-robin amplia de 1 → 5 IPs naquela VPS
```

## Mudanças concretas

### Proxy GCP (`djen-proxy/server.js` na VM)
- Lê `LOCAL_IPS` (csv, opcional). Se vazio = comportamento atual (legado).
- Quando definido:
  - `GET /proxy/N?url=…` — usa `https.request({ localAddress: LOCAL_IPS[N-1] })`
  - `GET /whoami` — IP público padrão da VM (compatível com Hostinger também)
  - `GET /whoami/N` — IP público pelo `localAddress` do índice N
- `GET /proxy?url=…` e `/djen` continuam funcionando idênticos (retro-compat).
- Entrego o `server.js` novo + README com `gcloud compute …` e `pm2 reload`.

### Front
- `src/utils/djenProxyPool.ts`:
  - `fetchSlotPublicIp(slot, { force? })` — `/whoami` → fallback `/health`, cache 5 min em memória.
  - `discoverExtraIps(slot, paths[])` — para cada path `/proxy/N`, chama `/whoami/N` e devolve `{ path, ip }`.
- Componente do Pool (em `src/pages/Configuracoes...` ou onde a lista é renderizada — confirmo ao abrir):
  - Chip "IP …" usando `fetchSlotPublicIp`.
  - Botão "+ Multi-IP" condicional a `/whoami` responder.
  - Dialog `shadcn` com paths + IPs detectados + botão "salvar como slot" (usa `addProxySlotRemote` existente, label sugerido `"Google VPS 1 — IP N"`).

### Banco
- **Nenhuma migration**. Tabela `djen_proxy_pool` já tem `base_url`, `token`, `label`, `enabled`. Cada IP novo = uma linha.

## Fora de escopo (deixa para depois)
- Replicar nas outras 4 Google VPSs (só após validar o piloto).
- Persistir cache de IP no Supabase.
- Mudar a lógica de round-robin.
