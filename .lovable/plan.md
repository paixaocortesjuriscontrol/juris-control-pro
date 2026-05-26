## Diagnóstico

O "Cooldown PJE 42s" que aparece em quase todos os tracks acontece porque o cooldown é **global** no cliente PJE Comunica — uma única variável de módulo `globalCooldownUntil` em `src/utils/pjeComunicaClient.ts` (linha 88). Quando **qualquer** VPS recebe um 429/503/504, essa variável é setada e **todos os workers das 6 VPSs** ficam esperando os 42s, mesmo quem está usando outra VPS que não foi rate-limitada.

Pontos no código:
- `setGlobalCooldown(...)` é chamado nas linhas 480, 486, 781 sem distinguir qual VPS atendeu a requisição.
- `awaitGlobalCooldown()` (linha 424) é chamado antes de toda requisição, igual para todas as VPSs.
- O motor Paralela (`useDjenTermosParalelaEngine.ts` linhas 1022-1026) ainda mostra "Cooldown PJE" no track porque consulta esse cooldown global.

## Solução

Tornar o cooldown **por proxy/VPS**, usando como chave o `via` (id da VPS / "direct") retornado pelo `djenProxyPool`.

### `src/utils/pjeComunicaClient.ts`

1. Trocar `let globalCooldownUntil = 0;` por `const cooldownByVia = new Map<string, number>()`.
2. `setGlobalCooldown(ms, via)` passa a aceitar a chave `via` e atualiza só essa entrada (mantém `Math.max` por chave).
3. `awaitGlobalCooldown(via)` e `getGlobalCooldownRemainingMs(via)` recebem a chave e leem só o cooldown daquela VPS.
4. No `doRequest` (linha 423):
   - Antes do fetch, se já houver um `forceVia` definido, aguardar o cooldown **daquela** VPS. Quando não houver `forceVia` (decisão de pool acontece dentro do `fetchDjenViaPool`), aguardar o menor cooldown disponível (e idealmente fazer o pool escolher uma VPS sem cooldown — passo 6).
   - Após o response, ler `via` via `readPoolViaFromResponse` e, em 429/502/503/504, chamar `setGlobalCooldown(wait, via)` — só penaliza a VPS culpada.
5. Atualizar a linha 781 (retry no outro bloco) da mesma forma — usar o `via` da resposta atual.
6. (Opcional, mas recomendado) Expor `getCooldownSnapshot(): Record<string, number>` e fazer `djenProxyPool` consultá-lo para evitar escolher uma VPS em cooldown quando há outras livres.

### `src/utils/djenProxyPool.ts`

- Aceitar/consumir o snapshot de cooldowns para que o round-robin pule VPSs em cooldown.

### `src/hooks/useDjenTermosParalelaEngine.ts`

- A leitura `getPjeComunicaGlobalCooldownRemainingMs()` (linha 1023) passa a receber o `via` da unidade (cada `WorkUnit` já é despachada para uma VPS no `VPSWorkerPool`). Mostrar `⏸ Cooldown PJE 42s` só quando **aquela** VPS estiver em cooldown; caso contrário, prosseguir.

### Exports a manter

- `awaitPjeComunicaGlobalCooldown` e `getPjeComunicaGlobalCooldownRemainingMs` continuam exportados (compat), mas agora aceitam parâmetro `via?: string`. Sem parâmetro, retornam o mínimo dos cooldowns (compat com chamadas antigas como o Kurier/Flash).

### Versão

- Bump `public/version.json` → `1.2.2`.

## Resultado esperado

- Um 429 em uma VPS pausa apenas aquela VPS por 42s.
- As outras 5 continuam trabalhando normalmente.
- O badge "Cooldown PJE" só aparece nos tracks cuja VPS está realmente penalizada.
