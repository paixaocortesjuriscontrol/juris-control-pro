# DJEN Termos Servidor: diagnóstico da lentidão (12 min → 95 min) e plano de correção

## O que os dados mostram

Duração média por execução (tabela `execucoes_servidor`, tipo `djen_paralela_servidor`):

```text
03/08  12,2 min   |  10/08  44,8 min
04/08  12,7 min   |  11/08  53,6 min
05/08  14,2 min   |  13/08  53,5 min
06/08  23,8 min   |  14/08  68,6 min
07/08  21,8 min   |  17/08  65,8 min (máx 106 min)
                  |  18/08  94,7 min
```

Causas confirmadas por consulta:

1. **Volume de unidades de busca quase triplicou.** Unidades processadas por dia saíram de 738 (03/08) para 1.907 (17/08). O maior salto é em monitoramentos de `parte`: 240 → 898 unidades/dia.
2. **Crescimento da base de monitoramentos.** Hoje há 385 monitoramentos ativos (211 parte, 101 processo, 44 advogado, 28 palavra-chave, 1 geral), com entradas novas em 22/07 (+15), 12–13/08 (+3) e 17/08 (+24) — exatamente as datas em que a curva de duração sobe.
3. **Fan-out por UF.** 41 dos 44 monitoramentos de advogado e 28 dos 211 de parte estão com UF `TODAS`/múltipla, gerando até 59 tribunais por termo. Cada tribunal/dia é uma unidade com requisições e delays próprios.
4. **Pool perdeu capacidade.** O motor usa **1 worker por VPS** (`Promise.all(slots.map(worker))`), ou seja concorrência = número de VPS saudáveis. Das 13 habilitadas, **VPS 4 e VPS 5 estão offline (HTTP 502 em /health)** → 11 pistas em vez de 13, e cada falha ainda consome tentativas de failover em outros slots.
5. **Custo fixo por requisição.** Latência das VPS é de 1,0–1,5 s por chamada, somada a delays fixos (400 ms entre páginas, 1.000 ms entre termos, 800 ms entre termos OR) e backoff de 1,5–6 s em 429. Com 2,6x mais unidades e menos pistas, o tempo cresce de forma linear/superlinear.
6. **Gravação dobrada e telemetria pesada.** Além dos inserts em `publicacoes_djen` (37 mil chamadas, média 28 ms), o motor ainda grava tudo em `publicacoes_djen_servidor` (58 mil chamadas, média 40 ms — a tabela legada) e atualiza progresso/heartbeat 100 mil vezes.

Importante: o volume **de resultado** não cresceu — publicações capturadas seguem estáveis (2.100–2.700/dia). O que cresceu foi o número de buscas necessárias para chegar ao mesmo resultado.

## Plano de correção

### Fase 1 — Recuperar capacidade (impacto imediato)
- Subir VPS 4 e VPS 5 (mesmo procedimento systemd `djen-proxy.service` já aplicado nas outras): volta de 11 para 13 pistas.
- Passar a concorrência de 1 para N workers por VPS (padrão 2, configurável por `PARALELA_LANES_POR_VPS`), com governador de taxa por VPS para não estourar o rate limit por IP do PJe Comunica.
- Ignorar automaticamente no pool as VPS com `saude_status <> 'ok'` na montagem dos slots, evitando gastar tentativas de failover em host morto.

### Fase 2 — Reduzir o fan-out (a causa raiz)
- Revisar os monitoramentos com UF `TODAS`: restringir aos tribunais onde o termo realmente aparece.
- Tabela de aprendizado por (monitoramento, tribunal): se um par não retorna nada há N dias úteis, ele passa a ser consultado em rodada reduzida (1x/dia na rodada da manhã) em vez de em todas as rodadas.
- Agrupar termos da mesma coordenação/tribunal em consultas OR quando a API permitir, reduzindo requisições por unidade.

### Fase 3 — Reduzir custo por unidade
- Parar de gravar em `publicacoes_djen_servidor` (legado, apenas leitura histórica) — elimina ~58 mil escritas por ciclo.
- Reduzir a frequência de flush de progresso (a cada N unidades ou 5 s, o que vier depois) mantendo heartbeat de 30 s.
- Delays adaptativos: reduzir `PAGE_DELAY`/`TERM_DELAY` enquanto não houver 429 na VPS e voltar ao valor conservador ao primeiro 429.

### Fase 4 — Observabilidade para não repetir
- Telemetria por unidade no `resultado` da execução: duração, requisições, páginas, retries, 429 e VPS usada.
- Aba de diagnóstico na tela DJEN Servidor: duração por rodada, unidades/minuto, top monitoramentos por tempo consumido e pistas ativas na rodada.
- Alerta por e-mail para `suporte@paixaocortes.adv.br` quando uma rodada passar de um limite configurável (ex.: 40 min) ou quando o pool tiver menos de 12 VPS saudáveis.

## Detalhes técnicos
- Arquivos: `monitor-servidor/engines/paralela.js` (slots, bandas, delays, gravação), `monitor-servidor/index.js` (dispatch), `src/pages/DjenServidor.tsx` + `src/hooks/useDjenServidor.ts` (diagnóstico), Edge Function `verificar-saude-pool-djen` (alertas).
- Nova tabela sugerida: `djen_monitoramento_tribunal_stats` (monitoramento_id, tribunal, ultima_ocorrencia_em, dias_sem_resultado) com GRANTs para `service_role` e leitura para `authenticated`, alimentada pelo próprio motor.
- Nenhuma mudança nas regras de validação parte/advogado nem na deduplicação existente.

## Ordem de execução sugerida
Fase 1 (rápida, devolve ~20–30% do tempo) → Fase 3 (barata) → Fase 2 (maior ganho, exige revisão de monitoramentos) → Fase 4.
