## Diagnóstico

Hoje a execução das 06:00 levou **3h17min (11.818s)** com 10 VPS habilitadas — o dobro/triplo do normal. Investigando o motor, achei o gargalo estrutural:

### O que está errado

Em `src/hooks/useDjenTermosParalelaEngine.ts` cada monitoramento com lista **OR** (ex.: Santander com 5–6 nomes de advogado) é despachado como **UMA única unidade** amarrada a **UMA única VPS**. Dentro dessa unidade os nomes rodam em série, com **`delay_between_termos_or = 1800 ms`** entre cada um (linha 149, laço 1530-1546). Enquanto isso, 8 das 10 VPSs ficam ociosas esperando.

Efeito prático para Santander advogado (6 nomes) em Banda 2 (27 tribunais):
- Cada unidade = 6 chamadas × ≥1,8 s de atraso + latência da API = ~30-60s de trabalho travado numa única VPS.
- 27 tribunais × 3 tipos = ~81 unidades pesadas → apenas 10 VPSs para engolir.
- Somando `delay_between_terms = 2500 ms` entre termos do mesmo tribunal, cada worker gasta minutos só em `sleep`.

Isso confirma o que vejo na tela: várias linhas "Executando" na mesma VPS (Google VPS 1) e várias em "Pendente / Aguardando slot..." — o problema não é falta de VPS, é **granularidade grande demais das unidades**.

Ponto secundário: `HOST_BUCKET_LIMITS['pje-comunica'] = 1` (linha 176) só é lido para exibir "concorrência" no cabeçalho — não gate a execução. Ok, mas o valor sinalizado enganava.

## Plano de correção

### 1. Explodir OR de advogado em unidades independentes
No dispatcher (bandas 0/1/2), em vez de empurrar `[{ tipo: 'advogado', monIds: [m.id] }]` como um único step, gerar **uma sub-unidade por nome OR**:
- Para cada monitoramento advogado com `termos_or`: criar 1 unidade para o nome principal + 1 unidade por termo OR (mesmo `tribunal`, mesmo `tipo`, `monId` do dono, mas com um `nomeOverride`/`oabOverride`).
- Cada sub-unidade vira uma linha independente na tela e é puxada por uma VPS diferente — o Santander de 6 nomes passa a rodar em paralelo em até 6 VPSs em vez de 1.
- Consolidação (dedup, persistência, contadores) continua por `monitoramento_id`, como já é hoje.

### 2. Reduzir a espera intra-unidade
Como cada VPS tem IP próprio (o rate-limit é por IP, não global):
- `delay_between_termos_or`: 1800 → **400 ms** (mesmo racional já aplicado a `delay_between_pages` na paridade com o servidor).
- `delay_between_terms`: 2500 → **800 ms**.

### 3. Espelhar no servidor
`monitor-servidor/engines/paralela.js` tem exatamente a mesma serialização de OR dentro de `buscarTermo`. Aplicar as mesmas duas mudanças:
- 1 unidade por termo OR na fila do worker principal.
- Delays reduzidos com o mesmo racional.

### 4. Corrigir o rótulo "concorrência"
Substituir a inicialização em `state.progress.concorrencia = HOST_BUCKET_LIMITS['pje-comunica']` (linha 308) por `vias.length` (nº de VPS ativas), que é o valor real.

## Estimativa de ganho

- Santander advogado em Banda 2: de ~10-15 min (serial nas 27 UFs) para ~2-3 min (paralelo real entre 10 VPSs).
- Execução total esperada: sair de 40-60 min (dia normal) para ~15-25 min. Dias com pico de 3h caem para <40 min.

## O que NÃO mexer

- Regras de dedup, validação parte/advogado, isolamento por coordenação.
- Ordem das bandas (TST → STF/STJ → outros → processo).
- Checkpoint / retomada.
- Servidor continua isolado do Browser em `publicacoes_djen`.

## Arquivos afetados

- `src/hooks/useDjenTermosParalelaEngine.ts` (dispatcher de bandas, config de delays, rótulo de concorrência).
- `monitor-servidor/engines/paralela.js` (mesma explosão de OR + delays).