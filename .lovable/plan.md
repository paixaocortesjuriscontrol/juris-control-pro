# DJEN Termos Servidor: execução travando/lenta

## O que está acontecendo agora (verificado)

- Execução `4047b8ee…` (`djen_paralela_servidor`) iniciada às 20:00 UTC segue **executando há mais de 1h12**, com heartbeat vivo (5s) — ou seja, não está travada, está **lenta**.
- No dia 17/08 já foram registradas **1.387 falhas de unidade** em `execucoes_servidor_falhas`, **todas com a mesma mensagem**: `Orçamento de 90s excedido (Falha ao consultar VPS DJEN)` — 578 pendentes/refiladas, 575 resolvidas em nova tentativa, 234 abandonadas após 3-4 tentativas.
- Teste de saúde das 13 VPS do pool `djen_proxy_pool`: **3 estão fora do ar** (Google VPS 1, Google VPS 2.1 e Google VPS 9 não respondem). As outras 10 responderam `/health` em menos de 1,1s.

Causa provável (a confirmar no passo 1): o orçamento por unidade (`UNIT_BUDGET_MS = 90s`) é **igual** ao timeout de uma única requisição ao proxy (`DJEN_PROXY_TIMEOUT_MS = 90s`). Assim, **uma única página lenta consome todo o orçamento da unidade**, que é abortada e refilada — e o mesmo trabalho é repetido 3-4 vezes, multiplicando o tempo total da execução. As 3 VPS mortas agravam: cada sorteio nelas queima tentativas e reduz o paralelismo real de 13 para 10.

## Plano

### 1. Confirmar a causa antes de mexer nos tempos
- Cruzar as falhas de hoje por tribunal/tipo e por VPS para separar "tribunal lento" de "VPS ruim".
- Verificar se as unidades abandonadas se concentram nos mesmos tribunais (indício de lentidão da API PJE) ou se estão espalhadas (indício de timeout mal calibrado).

### 2. Limpar o pool de proxies
- Marcar como desabilitadas no `djen_proxy_pool` as VPS que não respondem (Google VPS 1, 2.1, 9), para o daemon deixar de sortear slots mortos.
- Manter a verificação de saúde ativa: slot que falha o `/health` sai de circulação até voltar.

### 3. Separar timeout de requisição do orçamento da unidade
- Reduzir o timeout por requisição ao proxy (ex.: 35-45s) e manter o orçamento por unidade maior (ex.: 120s), de forma que uma página lenta gere **retry na próxima VPS** em vez de queimar a unidade inteira.
- Aplicar backoff/retry por página com troca de slot, em vez de abortar a unidade.

### 4. Reduzir retrabalho da refila
- Não refilar unidade que já concluiu parte das páginas: retomar da última página coletada.
- Baixar o máximo de tentativas por unidade quando o erro for de timeout de rede (evitar 4x o mesmo trabalho).

### 5. Visibilidade na tela
- Mostrar no card do DJEN Servidor: duração da execução, unidades concluídas x refiladas x abandonadas, e quais VPS estão fora do ar — hoje isso só é visível consultando o banco.

## Detalhes técnicos

- Arquivos envolvidos: `monitor-servidor/engines/paralela.js` (constantes `UNIT_BUDGET_MS`, `PAGE_DELAY_MS`, `TERM_DELAY_MS`, sharding), `monitor-servidor/proxyPool.js` (`PROXY_REQUEST_TIMEOUT_MS`, saúde/cooldown), `monitor-servidor/falhasRefila.js` (tentativas/refila).
- Ajustes de tempo ficam parametrizáveis por env (`PARALELA_UNIT_BUDGET_MS`, `DJEN_PROXY_TIMEOUT_MS`), sem hardcode novo.
- O daemon roda na VPS Hostinger; alterações em `monitor-servidor/` exigem deploy/restart do daemon lá (fora do preview Lovable).

## Fora de escopo
- Nenhuma mudança na lógica de validação parte/advogado nem na persistência unificada em `publicacoes_djen`.
