# Diagnóstico — DJEN Servidor "não inicia" e usa 1 VPS

## O que está acontecendo na verdade

### 1. A execução **iniciou**, mas o VPS está rodando código antigo
- Em `execucoes_servidor`, o job `3f575783-…` está com `status='busy'`, `iniciado_em=11:01:34`, heartbeat fresco.
- O `progresso.itens` salvo tem ids como `"8d97420f-…"` (UUID de monitoramento) — formato da **engine antiga**.
- A `monitor-servidor/engines/paralela.js` atual no repositório gera ids no formato `"${tipo}|${tribunal}"` (ex.: `"parte|TJSP"`) e mensagens "Aguardando slot...".
- **Conclusão:** o `git pull && pm2 restart jc-monitor-servidor` pedido na conversa anterior **não foi aplicado** no `srv877805`. O VPS continua com a versão antiga, que não popula os 334 tribunais e fica travada nos itens "pendente" que aparecem na tela.

### 2. "1 worker VPS · Pool 1/1" está correto, não é bug
- `workers_servidor` tem apenas **1 host físico** (`srv877805`), com 3 slots — um por tipo:
  - `hostinger-01-djen_paralela_servidor` (busy)
  - `hostinger-01-djet_pautas_servidor` (idle)
  - `hostinger-01-kurier_servidor` (idle)
- Para DJEN existe **1 slot só**. A engine é **sequencial dentro do slot** (loop `for (const item of itens)`), invocando a edge `monitorar-djen` 1 tribunal por vez.
- Por isso, mesmo após atualizar o VPS, o processamento continuará usando **um único worker** processando 334 tribunais em série — vai funcionar, mas devagar.

## Plano de correção

### Passo 1 — Aplicar a engine nova no VPS (obrigatório)
No host `srv877805`:
```bash
cd /opt/juris-control-pro
git pull
pm2 restart jc-monitor-servidor
pm2 logs jc-monitor-servidor --lines 50
```
Esperado nos logs: `paralela.start` seguido de `paralela.monitoramentos` com o total, e o `progresso.itens` no banco passar a usar ids `tipo|tribunal` com mensagens `TJxx: n/m termos`.

Antes disso, **cancelar** a execução órfã atual (`3f575783-…`) pelo botão "Forçar Parada" ou via update direto, para o worker pegar um job novo já com a engine atualizada.

### Passo 2 — Paralelizar tribunais dentro do mesmo slot (opcional, mas resolve a lentidão)
A `paralela.js` hoje processa os 334 (tribunal, tipo) em série. Acrescentar um pool de concorrência interno (ex. 6–8 chamadas simultâneas à edge `monitorar-djen`) faz **1 VPS** se comportar como vários workers lógicos, sem precisar provisionar host extra.

Mudanças propostas em `monitor-servidor/engines/paralela.js`:
- Variável `PARALELA_CONCURRENCY` (default 6, configurável via `.env`).
- Substituir o `for (const item of itens)` por um runner `runWithConcurrency(itens, PARALELA_CONCURRENCY, async (item) => { ... })` que mantém a lógica atual (mark `executando` → loop dos `monitoramentoIds` → mark `concluido/erro` → `flushProgresso`).
- `flushProgresso` continua igual (já tem throttle de 800ms).
- `isCancelled()` é consultado no início de cada item e antes de cada `invokeDjen`, preservando o "Forçar Parada".

Resultado esperado na UI: as barras de tribunais avançam em paralelo (~6 ao mesmo tempo), `currentWorker` continua sendo o mesmo `hostinger-01`, e a barra global "0/334" sobe rapidamente.

### Passo 3 — Multi-host de verdade (não vou fazer agora, só registrar)
Para ter **N VPSs** físicas processando DJEN de fato, é preciso:
- Subir `monitor-servidor` em outro host (Hostinger-02 etc.) com `WORKER_ID_BASE` diferente.
- Trocar o split de trabalho: em vez de 1 job grande que itera 334 tribunais, enfileirar **N sub-jobs** (um por bloco de tribunais) e deixar o `lease_proxima_execucao_servidor` distribuir entre os hosts.
- Isso é uma refatoração maior (schema do job + UI agregadora) — só vale a pena depois que o Passo 2 não for suficiente.

## Arquivos que serão tocados (apenas se você aprovar o Passo 2)

- `monitor-servidor/engines/paralela.js` — adicionar pool de concorrência interno.
- Nenhuma mudança em UI, hooks ou edge functions.

## O que eu **não** vou mudar

- `useDjenServidor.ts` / `DjenServidorParalelaCard.tsx`: a tela já reage ao novo formato de `progresso.itens`; só precisa de dados vindos da engine nova.
- `supabase/functions/monitorar-djen/index.ts`: já aceita `tribunais[]` + `skipServidorProgress` — não há ajuste pendente.
- Schema do banco: nenhuma alteração.

## Confirme antes de eu implementar

1. Faço a paralelização interna (Passo 2) com `PARALELA_CONCURRENCY=6` default?
2. Quer também um botão na UI para **cancelar** explicitamente a execução órfã `3f575783-…` (caso "Forçar Parada" não esteja respondendo)?
