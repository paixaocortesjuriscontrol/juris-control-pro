# Plano: reduzir "proxy slot timeout" e proteger contra perda de publicações

Escopo restrito a `src/utils/djenProxyPool.ts` e `src/hooks/useDjenTermosParalelaEngine.ts`. Nenhuma outra tela, motor ou lógica de busca muda.

## 1. Aumentar teto de espera por VPS

Em `src/utils/djenProxyPool.ts`:
- `PROXY_SLOT_TIMEOUT_MS`: **25 000 → 45 000 ms**.

Motivo: quando a API PJE Comunica está sob carga, respostas chegam entre 25–40 s. 25 s hoje está estourando na parte estável do upstream, não em falha real da VPS.

## 2. Tratar timeout de upstream como "lento", não "offline"

Ainda em `src/utils/djenProxyPool.ts`:
- Introduzir estado runtime `slow` (separado de `online/offline`).
- Quando o erro capturado for exatamente `proxy_slot_timeout_*ms` (upstream demorou), chamar um novo `markUpstreamSlow(slot.id, msg)` **em vez de** `markOffline(...)`. Registrar `lastError`, mas manter `online: true` para o próximo round-robin.
- `markOffline` continua sendo usado para: erro de rede/DNS/TLS, HTTP 502/503/504 sustentados, erros de config (401/403 de token), qualquer coisa que **não** seja timeout do PJE via nossa VPS.
- `getDjenProxySlotsRuntime()` passa a expor `slow: boolean` no retorno.

Efeito visual (sem mexer em outras telas além dos dois cards que já leem esse runtime — `PoolProxyDjenCard` e `WorkersDjenVpsPanel`):
- Chip verde: online normal.
- Chip **amarela "Lento"**: última chamada timeoutou no upstream, mas continua na fila.
- Chip vermelha "Offline": erro real da VPS. Só entra aqui quando a VPS realmente não respondeu (rede/config/5xx sustentado).

## 3. Proteção contra perda de publicações (checkpoint só fecha em sucesso)

Em `src/hooks/useDjenTermosParalelaEngine.ts`:
- Hoje, quando as 5 tentativas de um termo esgotam, ele é registrado como concluído no checkpoint com 0 achados. Se o motivo foi PJE 500/timeout em cadeia, aquela publicação some daquele ciclo.
- Mudança: quando o motor detectar que **todas** as tentativas falharam com erro de upstream (`proxy_slot_timeout_*`, `upstream_status_5xx`, `429` persistente), **não fechar** o termo no checkpoint — marcar internamente como `precisa_refazer: true` e propagar mensagem "Termo com upstream instável — será refeito no próximo ciclo".
- No próximo ciclo agendado (ou ao clicar Retomar), o motor pega esses termos primeiro, antes dos demais.
- Termos que retornaram 200 com 0 publicações continuam sendo fechados normalmente (é resposta legítima do PJE, não falha).

## 4. Paridade no servidor (opcional, mesma release)

Espelhar a mesma proteção em `monitor-servidor/engines/paralela.js`:
- Não marcar `execucao_servidor.status = 'concluido'` para uma unidade cujas tentativas terminaram todas em erro de upstream — deixar em `precisa_refazer` para o reaper/próxima janela retomar.
- Manter a lógica atual de sucesso e de "0 achados legítimos" intacta.

## Fora do escopo

- Não vou alterar retry base delay, número de tentativas, delays entre termos, motor de OAB/Parte/Advogado, comparador, análise DJEN, Kurier, distribuição TST, nem qualquer outra tela.
- Não vou tentar mitigar a instabilidade do PJE em si — apenas absorver melhor.

## Como validar depois

1. Rodar um tribunal grande (STF Parte, por exemplo). Durante um pico do PJE, observar que as chips ficam amarelas "Lento" em vez de vermelhas, e que a execução não pinta VPS como Offline em massa.
2. Verificar em `execucoes_servidor` (ou no checkpoint local via console) que termos com falha por upstream ficam com `precisa_refazer: true` e são recolhidos no próximo ciclo — nenhuma publicação "some" entre execuções.
3. Se após aplicar isso ainda houver perda, o próximo passo é aumentar `max_retries` ou o `retry_base_delay` — mas só depois de medir.
