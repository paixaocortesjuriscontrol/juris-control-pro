# Por que o DJEN Termos Servidor termina antes que o Browser

Correção da análise anterior: os dois motores compartilham o **mesmo pool de 13 VPS** (`djen_proxy_pool` / `workers_djen_vps`) e o mesmo endpoint PJE Comunica. A diferença de velocidade **não é concorrência de rede** — é overhead de execução e política de espera no cliente.

## Onde a diferença realmente aparece (código medido)

### 1. Delays "de segurança" só existem no Browser
`useDjenTermosParalelaEngine.ts` → `CONFIG`:
- `delay_between_terms: 1000 ms`
- `delay_between_pages: 400 ms`
- `delay_between_parte_or: 800 ms`
- `delay_between_advogado_or: 1800 ms`
- `retry_base_delay: 8000 ms`

No `supabase/functions/monitorar-djen/index.ts` **não há delays entre termos/páginas/OR** — só `fetchWithRetry` com `baseDelay = 3000 ms` acionado *apenas em 429/erro*. Em uma busca típica isso soma centenas de segundos extras por coordenação no Browser.

### 2. Serialização por "bucket de host" (só no Browser)
Browser força `HOST_BUCKET_LIMITS['pje-comunica']` — mesmo com 13 VPS livres, só N workers podem bater no bucket lógico `pje-comunica` ao mesmo tempo. O Servidor não tem esse teto: cada invocação de `monitorar-djen` é isolada.

### 3. Modelo de invocação das VPS
- **Servidor**: dispara N Edge Functions/VPS em paralelo, cada uma processa seu shard end‑to‑end e grava direto no Postgres com service‑role. O disparador não espera round‑trip por chamada — é fan‑out.
- **Browser**: `await` sequencial por unidade dentro do worker (`worker(v)`), com cooldown por VPS quando alguma dá 429 (linhas 1274‑1303). Um 429 em qualquer VPS pausa aquele worker inteiro.

### 4. Custo de UI no Browser
Para cada publicação encontrada o Browser:
- faz `insert/upsert` unitário no Supabase (round‑trip do IP do usuário),
- invalida React Query,
- re‑renderiza o card de progresso (`concorrencia`, `mensagem`, contadores por tribunal),
- valida no DOM/estado.

O Servidor grava em lotes direto no Postgres, sem render nem invalidação.

### 5. Rescues e validações extra em série
Browser roda `validarAdvogadoNoContent`, Metadata Rescue e Cross‑coordination Rescue **no mesmo thread** do worker. O Servidor faz isso paralelo por shard.

### 6. Recuperação de erros
- Servidor: 4 tentativas com backoff a partir de 3 s.
- Browser: `retry_base_delay: 8000 ms` + retentativa em outra VPS + cooldown local. Um único tribunal instável (STF hoje) drena minutos.

## Resumo
Mesma frota de VPS, mesma API upstream. O Servidor é mais rápido porque **não tem delays de UX, não tem bucket‑lock por host lógico, dispara em fan‑out sem esperar round‑trip, grava em lote e não renderiza UI**. Somando, no Browser cada publicação custa ~1–2 s extras de espera artificial + overhead de UI/insert.

## Plano para acelerar o Browser

### A. Alinhar delays ao Servidor
Em `src/hooks/useDjenTermosParalelaEngine.ts`:
- `delay_between_terms`: 1000 → **0 ms** (Servidor não tem)
- `delay_between_pages`: 400 → **0 ms**
- `delay_between_parte_or`: 800 → **150 ms** (mantém margem mínima)
- `delay_between_advogado_or`: 1800 → **300 ms**
- `retry_base_delay`: 8000 → **3000 ms** (igual ao Servidor)

### B. Relaxar bucket lock quando há VPS livres
- Se todas as chamadas passam por VPS distintas (IP distinto), **não contar contra o mesmo bucket** `pje-comunica`. Aplicar `HOST_BUCKET_LIMITS` apenas quando a via é `Direto` (sem VPS).
- Ganho: elimina serialização artificial que hoje deixa VPS ociosas.

### C. Fan‑out real por VPS
- Trocar o modelo "worker sequencial por via" por **fila compartilhada com N=13 workers concorrentes**, um por VPS habilitada, sem `await` cruzado entre eles.
- Um 429 numa VPS marca só aquela VPS em cooldown; as outras 12 continuam sem pausa.

### D. Insert em lote e progresso throttled
- Acumular publicações em memória e fazer `upsert` a cada **50 itens ou 2 s**, o que vier primeiro.
- Throttle do `setState` de progresso a **500 ms** (via `requestAnimationFrame`) — hoje re‑renderiza a cada publicação.

### E. Fast‑fail em tribunal sobrecarregado
- Reaproveitar o classificador "Upstream Overload" do Servidor: se um tribunal (STF) retorna 500 "busy" 2× seguidas, marcar como *deferred* e re‑enfileirar no final, sem consumir workers.

### O que NÃO muda
- Pool de 13 VPS, endpoint PJE Comunica, tabelas oficiais (`publicacoes_djen`), regras parte × advogado estrito, dedupe, ordem STF por último.

## Ganho esperado
Com A+B+C+D o Browser deve rodar em **~30–40% do tempo atual**, próximo (não igual) ao Servidor. A diferença residual é o custo inevitável de UI + IP único do usuário para gravação no Supabase.
