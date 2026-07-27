## Diagnóstico confirmado

1. **A reversão funcionou.** `monitor-servidor/engines/paralela.js` está hoje idêntico à versão de 22/07 — a mesma que rodava na sexta (24/07). O commit de 25/07 ("Alinhou contadores e ícones") não tocou nesse arquivo.

2. **O "RETRY" não é novo.** O rótulo `RETRY <termo>` existe no motor desde **23/06** (bloco que refila falhas pendentes do mesmo dia BRT). Ele só aparece quando um tribunal falha e é reenfileirado.

3. **Causa real:** em `execucoes_servidor_falhas` (27/07) há dezenas de falhas com erro **`fetch failed`**, quase todas no **TST**. Os pendentes agora são exatamente `F. Cafe` (parte, TST) e `SANTANDER` (parte, TST), ambos com 2 tentativas; `EPB` (TST) já foi **abandonado** com 6 tentativas. É o TST derrubando a conexão em buscas amplas por parte.

4. **O motor roda na VPS Hostinger** — mudanças no projeto só valem após atualizar/reiniciar o `monitor-servidor` lá.

## Plano

### Passo 1 — Cancelar a execução em andamento
Cancelar a execução `djen_paralela_servidor` ativa (iniciada 13:23, worker `hostinger-01`) via `cancelar_execucao_servidor`, e marcar como abandonadas as falhas pendentes do dia para o TST, zerando o loop de RETRY.

### Passo 2 — Reduzir a queda no TST (raiz do RETRY)
Em `monitor-servidor/engines/paralela.js`, para unidades do TST em busca por **parte**:
- Timeout maior por requisição e **degradação progressiva de `pageSize`** já no primeiro `fetch failed` (hoje só degrada em HTTP 500).
- Backoff exponencial entre páginas na falha de rede, em vez de derrubar a unidade inteira.
- Retomar a paginação **da última página confirmada** da unidade, evitando refazer 100+ páginas a cada retry.

### Passo 3 — Limitar o ruído de RETRY
- Teto de tentativas por unidade/dia menor (hoje chega a 6 antes de abandonar).
- Rótulo passa a `RETRY 2/3 — SANTANDER (TST)` para deixar claro que é reenvio da mesma busca, não execução extra.

### Passo 4 — Visibilidade
No quadro de execuções do dia (Análise DJEN), exibir resumo de **falhas pendentes por tribunal**, separando "motor com problema" de "TST instável".

### Passo 5 — Deploy na VPS
Nada disso entra em vigor sem atualizar o `monitor-servidor` na Hostinger (`git pull` + `pm2 restart jc-monitor-servidor`). Vou deixar o comando pronto ao final.

### Detalhes técnicos
Arquivos: `monitor-servidor/engines/paralela.js` (paginação, retry, rótulo) e o componente do quadro de execuções + `src/hooks/useExecucoesDoDiaServidor.ts` (resumo de falhas). Sem migração de banco — `execucoes_servidor_falhas` já tem `tentativas`, `status`, `ultimo_erro`.
