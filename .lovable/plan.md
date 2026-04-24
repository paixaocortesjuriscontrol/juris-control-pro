
# POC — Pool de VPS para DJEN Termos Paralela (1 VPS, validação)

## Objetivo
Validar, com a VPS Hostinger que você já tem, se rotear as chamadas da API PJE Comunica (`comunicaapi.pje.jus.br`) por um IP diferente elimina os erros `429 Too Many Attempts` que hoje ocorrem no motor "DJEN Termos Paralela". Sem mexer nos motores Pro / Flash / STF Flash. Sem instalar nada no app além de um toggle.

## Por que isso resolve o 429
Hoje todas as 5 workers paralelas saem do mesmo IP (browser do usuário). A API PJE Comunica limita por IP. Com 1 VPS extra como proxy, a maior parte do tráfego passa a sair do IP da Hostinger — IP "limpo", sem histórico recente de uso massivo — duplicando na prática o orçamento de requests/min.

## Arquitetura

```text
                        ┌──────────────────────────────────────┐
                        │  Browser (motor Paralela existente)  │
                        └──────────────────┬───────────────────┘
                                           │ round-robin
                          ┌────────────────┼────────────────┐
                          ▼                ▼                ▼
                    [VPS proxy 1]   (slot 2 vazio)   (chamada direta
                    djen-proxy       (futuro)        como fallback)
                    Hostinger
                    IP fixo
                          │
                          ▼
                  comunicaapi.pje.jus.br
```

- **Pool inicial:** 1 VPS (a sua) + chamada direta como segundo "slot". Round-robin alterna entre os dois → cada um recebe metade do tráfego, o que já deve cortar o 429 quase pela metade.
- **Quando comprar mais VPS:** o pool é configurável na UI. Você adiciona o IP/token novo em Configurações e o round-robin passa a usar 3, 4, N slots automaticamente.

## Entregas

### 1. Novo proxy `djen-proxy` (separado do `pje-proxy`)
Pasta nova `djen-proxy/` com:
- `server.js` — HTTP nativo Node, zero dependências, espelha o estilo do `pje-proxy` atual
- Endpoints:
  - `GET /health` → `{ ok, ip, uptime_s }`
  - `GET /djen?<query>` → repassa GET para `https://comunicaapi.pje.jus.br/api/v1/comunicacao?<query>`, retorna o JSON cru + `status` upstream + `elapsed_ms`. Header obrigatório `X-Proxy-Token`.
- `package.json` mínimo
- `README.md` com passo a passo Hostinger (idêntico em estilo ao `pje-proxy/README.md`: PM2, Nginx subpath, openssl token)
- `setup.sh` — script idempotente que: cria pasta, escreve `server.js`, gera `PROXY_TOKEN` se não existir, sobe via PM2, salva, configura `pm2 startup`. Você só roda `bash setup.sh` na VPS.

### 2. Camada de pool no app (`src/utils/djenProxyPool.ts`)
- Lê config do `localStorage` (`djen_proxy_pool`) — array `{ url, token, enabled, label }`
- Função `pickNextProxy()` → round-robin com pulo de proxies marcados como "offline temporariamente"
- Função `fetchDjenViaPool(queryParams, signal)` que:
  1. Sorteia próximo slot
  2. Se slot = "direto" → chama `comunicaapi.pje.jus.br` igual hoje
  3. Se slot = VPS → `GET https://<vps>/djen-proxy/djen?<query>` com header `X-Proxy-Token`
  4. Em erro de rede / 5xx do proxy → marca slot como offline por 60s, refaz via próximo slot (fallback transparente)
  5. Em 429 do upstream → propaga para o motor tratar como hoje (cooldown global)
- Health-check leve (chama `/health` ao adicionar a VPS na UI)

### 3. Integração no motor Paralela
- `src/utils/pjeComunicaClient.ts`: `fetchWithRetry` passa a usar `fetchDjenViaPool` quando o pool tiver pelo menos 1 VPS habilitada **E** a flag `useProxyPool` estiver ligada. Se pool vazio ou flag off, comportamento idêntico ao atual.
- Flag `useProxyPool` lida do `localStorage` (`djen_proxy_pool_enabled`). Default: `false`. Não afeta Pro / Flash / STF Flash (eles não chamam essa branch porque a flag é checada só na chamada feita pelo `useDjenTermosParalelaEngine`).
- **Importante:** Pro e Flash continuam 100% inalterados. Só a Paralela muda.

### 4. UI em Configurações (aba existente)
Novo card "Pool de Proxies DJEN (POC)":
- Toggle global "Usar pool de proxies para DJEN Paralela"
- Tabela com slots cadastrados (label, URL, status verde/vermelho via health-check, botão remover)
- Formulário "Adicionar VPS": label, URL base (ex: `https://meudominio.com/djen-proxy`), token, botão "Testar e salvar"
- Contador no rodapé: "X requests via VPS / Y direto na última execução" (estatística de sessão)

### 5. Telemetria mínima
- O motor Paralela passa a logar no console (e no `track.mensagem` final) quantas chamadas foram via cada slot e quantos 429 cada slot recebeu. Sem persistência em DB nesta POC — só `console.table` para você comparar antes/depois.

## Arquivos

**Criar:**
- `djen-proxy/server.js`
- `djen-proxy/package.json`
- `djen-proxy/README.md`
- `djen-proxy/setup.sh`
- `src/utils/djenProxyPool.ts`
- `src/components/configuracoes/PoolProxyDjenCard.tsx`

**Editar:**
- `src/utils/pjeComunicaClient.ts` — `fetchWithRetry` opcionalmente usa o pool
- `src/hooks/useDjenTermosParalelaEngine.ts` — passa flag `viaProxyPool: true` na chamada (1 linha)
- `src/pages/Configuracoes.tsx` — render do `PoolProxyDjenCard`

## Fora de escopo (POC)
- Múltiplas VPS simultâneas (a infra suporta, mas validamos com 1 primeiro)
- Edge Function dispatcher (você escolheu round-robin no cliente)
- Pool para Pro / Flash / STF Flash (esses motores ficam intocados)
- Persistência de métricas em DB
- Dashboard histórico de uso por proxy

## Critérios de aceitação
1. `bash setup.sh` na VPS sobe o `djen-proxy` em < 1 min, sem instalar npm packages
2. `curl https://<vps>/djen-proxy/health` retorna `{ ok: true, ip: "<ip da Hostinger>" }`
3. Em Configurações, conseguir cadastrar a VPS, ver bolinha verde, e ligar o toggle
4. Executar "DJEN Termos Paralela" com pool ON: console mostra ~50% das chamadas indo pela VPS
5. Comparativo: rodar a mesma faixa de datas com pool OFF vs ON, contar 429s no console. Esperado: redução perceptível
6. Se a VPS cair no meio da execução, o motor termina sem erro, usando 100% chamada direta (fallback transparente)
7. Pro, Flash e STF Flash continuam funcionando exatamente como hoje (sem regressão)

## Próximo passo após validação
Se a POC mostrar que 1 VPS já corta 429 ~50%, fica óbvio o ganho de adicionar mais 2-4 VPS (basta rodar `setup.sh` em cada uma e cadastrar na UI — zero código novo).
