# VPS 5 (401) + botão "Recoletar faltantes"

## 1. Resolver a VPS 5

Hoje uma das unidades abandonadas morreu com `HTTP 401 (Google VPS 5): {"error":"unauthorized"}` — o `PROXY_TOKEN` da vm05 não confere com o token guardado em `djen_proxy_pool`. Enquanto isso persiste, toda unidade sorteada para essa VPS falha.

Duas frentes:

- **Correção na VM**: roteiro SSH para conferir o `PROXY_TOKEN` no `djen-proxy.service` da vm05, alinhar com o token do pool e reiniciar o serviço (`daemon-reload` + `restart`).
- **Proteção no motor**: `401`/`403` de uma VPS passa a marcar aquele nó como indisponível pelo resto da rodada (curto-circuito no pool, igual ao tratamento de nó offline) e a unidade é refilada em outra VPS **sem consumir tentativa** — hoje ela queima as 3 tentativas contra a mesma VPS quebrada. Também vira alerta na tela de saúde do pool.

## 2. Botão "Recoletar faltantes"

Ao lado do marcador "parcial (N)" nos cards de execução, um botão que dispara uma rodada curta processando **apenas** as unidades sem coleta do dia — em vez de repetir a varredura inteira (~1h).

Comportamento:
- Reabre as falhas do dia com status `pendente` + `abandonado` (tentativas zeradas).
- Enfileira uma execução com payload `{ somenteFalhas: true }`; o motor monta a fila a partir dessas falhas, ignorando o mapeamento normal tribunal × monitoramento.
- Nesse modo usa concorrência menor e orçamento por unidade maior — as abandonadas são justamente as que estouraram tempo, e reduzir a pressão evita recriar o congestionamento.
- Ao terminar, unidades coletadas viram `resolvido`; se ainda sobrar alguma, a execução fecha como `concluido_parcial` normalmente.
- Botão desabilitado enquanto houver execução em andamento, com confirmação antes de disparar.

## Detalhes técnicos

- `monitor-servidor/proxyPool.js`: marcar nó como indisponível na rodada ao receber 401/403 e não devolvê-lo em novos sorteios.
- `monitor-servidor/falhasRefila.js`: `ehRateLimit` ganha companhia de `ehAuthProxy` (401/403 → não consome tentativa); novas funções `lerFalhasNaoColetadas` (pendente + abandonado) e `reabrirFalhasAbandonadas` (status→`pendente`, tentativas→0).
- `monitor-servidor/engines/paralela.js`: em `run`, quando `payload.somenteFalhas` for verdadeiro, construir a fila a partir das falhas do dia, com concorrência reduzida e orçamento por unidade ampliado.
- `src/hooks/useDjenServidor.ts`: mutation `recoletarFaltantes` — chama a reabertura das falhas e insere a execução com `{ somenteFalhas: true, diarioYmd }`.
- UI: botão junto ao marcador parcial em `src/components/djen/ExecucoesDoDiaAdminCard.tsx` e na tela `src/pages/DjenServidor.tsx`.
- Deploy Hostinger depois do merge: `git pull` + `pm2 restart jc-monitor-servidor` (o botão depende do modo novo no motor).
