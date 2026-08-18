# Recoletar as unidades que ficaram sem coleta

## Situação de hoje (18/08, verificada no banco)

Em `execucoes_servidor_falhas` (dia 18/08) existem **30 unidades abandonadas** — são elas que aparecem como "parcial (30)" no card das 18:40:

```text
24  Orçamento de 90s excedido      STJ, TRT1, TRT3..TRT24 (15 tribunais)
 4  Orçamento de 120s excedido     TST, TRT2, TRT15
 1  HTTP 401 (Google VPS 5) unauthorized   TRT18
 1  HTTP 500                       TST
```

Outras 626 unidades falharam e foram **resolvidas** pelo refila (inclui os 429). O problema é só o grupo `abandonado`: com 3 tentativas atingidas, o refila as ignora (`tentativas < 3`), então nenhuma rodada seguinte do dia volta a buscá-las. Hoje só há duas saídas manuais: rodar tudo de novo (1h) ou nada.

## O que fazer

### 1. Botão "Recoletar faltantes" na tela DJEN Servidor
Ao lado do marcador "parcial (N)": dispara uma execução dedicada que processa **apenas** as unidades `pendente` + `abandonado` do dia, sem varrer a base inteira. Rodada curta (minutos, não uma hora), e o resultado marca as unidades como `resolvido`.

### 2. Modo `somenteFalhas` no motor
Nova execução com payload `{ somenteFalhas: true }`: o motor monta a fila lendo `execucoes_servidor_falhas` do dia (pendente + abandonado, tentativas zeradas), ignora o mapeamento normal de tribunal × monitoramento, e usa orçamento por unidade mais generoso (as abandonadas são justamente as lentas) com concorrência menor, para não recriar o congestionamento que causou os timeouts.

### 3. Reaproveitar automaticamente na próxima rodada agendada
Na primeira rodada de cada dia após uma execução parcial, as unidades `abandonado` do mesmo dia entram na fila uma vez a mais (com tentativas reiniciadas e prioridade alta), em vez de ficarem paradas até o dia seguinte.

### 4. Fechar o 401 da VPS 5
A unidade TRT18 morreu com `HTTP 401 unauthorized` na Google VPS 5 — token do proxy divergente naquela VM. Enquanto não normalizar, ela some do pool a cada rodada. Roteiro: conferir `PROXY_TOKEN` no `djen-proxy.service` da vm05 e reiniciar o serviço.

## Detalhes técnicos

- `monitor-servidor/falhasRefila.js`: função nova `lerFalhasNaoColetadas` (pendente + abandonado) e `reabrirFalhasAbandonadas` (status→pendente, tentativas→0).
- `monitor-servidor/engines/paralela.js`: em `run`, quando `payload.somenteFalhas` for verdadeiro, construir a fila a partir das falhas do dia; orçamento por unidade elevado e concorrência reduzida nesse modo.
- `src/hooks/useDjenServidor.ts`: mutation `recoletarFaltantes` inserindo em `execucoes_servidor` com `tipo` da engine paralela e payload `{ somenteFalhas: true, diarioYmd }`.
- UI: `src/components/djen/ExecucoesDoDiaAdminCard.tsx` e `src/pages/DjenServidor.tsx` — botão junto ao marcador parcial, com confirmação e feedback de rodada em andamento.
- Deploy Hostinger: `git pull` + `pm2 restart jc-monitor-servidor` antes de usar o botão.
