# DJEN Servidor: (1) subir VPS 4 e 5, (2) de onde vem o aumento de unidades

## Parte 1 — Subir VPS 4 e VPS 5

Estado confirmado agora no `djen_proxy_pool`: apenas duas VPS fora — **Google VPS 4** (`djen-google4.juriscontrol.adv.br/djen-proxy`) e **Google VPS 5** (`djen-google5.juriscontrol.adv.br/djen-proxy`), ambas com `HTTP 502 em /health`. Certificados válidos (expiram em 01/10/2026), ou seja o Nginx está no ar e o Node por trás está morto — exatamente o quadro da vm03 antes da conversão para systemd.

Procedimento por VM (via botão SSH do Google Cloud, primeiro na vm04, depois na vm05):

```text
1. Conferir a porta do Node em server.js e o proxy_pass do Nginx (na vm03 era 8089).
2. Criar o arquivo de variáveis de ambiente do proxy com PROXY_TOKEN (valor de
   djen_proxy_pool.token da própria VM) e PORT, com permissão 600.
3. Criar /etc/systemd/system/djen-proxy.service com:
   User=paixaocortesjuriscontrol
   WorkingDirectory=/home/paixaocortesjuriscontrol/djen-proxy
   EnvironmentFile apontando para o arquivo do passo 2
   ExecStart=/usr/bin/node server.js
   Restart=always / RestartSec=3 / SupplementaryGroups=letsencrypt
4. sudo systemctl daemon-reload && sudo systemctl enable --now djen-proxy
5. sudo systemctl status djen-proxy --no-pager
6. curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8089/health  (esperado 200)
```

Validação final: rodar a Edge Function `verificar-saude-pool-djen` e confirmar as 13 VPS em `ok`. Os comandos completos e o token exato de cada VM eu passo no chat quando você estiver com o SSH aberto (token não vai para arquivo do projeto).

## Parte 2 — Onde está o aumento de unidades (diagnóstico confirmado)

O aumento **não vem de monitoramentos novos de parte**. Consultas feitas agora:

- `monitoramentos_djen` criados desde 25/07: 24 em 17/08 (todos tipo **processo**), 2 em 13/08, 1 advogado em 12/08. **Zero novos monitoramentos de parte.**
- Nenhuma edição alterou o fan-out por tribunal dos monitoramentos de parte (as 23 edições de 17/08 são dos monitoramentos de processo criados no mesmo dia).

O que realmente triplicou são as **unidades de retry re-injetadas** a partir de `execucoes_servidor_falhas` (o motor injeta cada falha pendente do dia como unidade extra nas rodadas seguintes):

```text
dia     falhas/dia   fetch failed   timeout 90s
03/08       171           146            24
07/08       350           309            41
10/08       840           741            99
13/08     1.013           606           407
14/08     1.239           642           597
17/08     1.498           820           678
18/08       477 (parcial)   0           477
```

Cada tupla que falha volta como unidade nova nas rodadas do mesmo dia; se falhar de novo, gera outro retry e ainda queima tentativas de failover em VPS morta. A execução de 18/08 07:30 mostra o efeito: 56 unidades concluídas contra dezenas de unidades `retry|...` no checkpoint.

Causa raiz das falhas: capacidade do pool insuficiente para a carga (11 pistas em vez de 13), `fetch failed` nas VPS instáveis e estouro do orçamento de 90s por tupla. É um ciclo de realimentação: menos pistas → mais timeout → mais retries → mais unidades → rodada mais longa.

### Correções propostas (após subir as VPS)

1. **Medir o efeito das VPS 4 e 5 primeiro**: com 13 pistas, comparar falhas/dia e duração média da rodada.
2. **Teto de retry por rodada**: limitar as unidades de retry injetadas (ex.: `SERVIDOR_RETRY_MAX_POR_RODADA`, padrão 150), priorizando tuplas com menos tentativas, para que retry nunca desloque a busca primária.
3. **Retry só na última rodada do dia**: acumular as falhas e reprocessar na rodada final, em vez de re-injetar em todas as rodadas.
4. **Não refilar tupla cuja VPS estava offline**: falha `fetch failed`/502 em VPS com `saude_status <> 'ok'` volta para a fila sem contar tentativa e só quando o pool estiver saudável.
5. **Orçamento por tupla adaptativo**: 120s em tribunais grandes (TST/TRT2) e 90s nos demais — timeouts respondem hoje por ~45% das falhas.
6. **Painel de diagnóstico** na tela DJEN Servidor: falhas por dia, taxa de retry e pistas ativas por rodada, para detectar a realimentação antes de a rodada passar de 40 min.

## Detalhes técnicos
- Pool/health: tabela `djen_proxy_pool`, Edge Function `verificar-saude-pool-djen`.
- Motor: `monitor-servidor/engines/paralela.js` (injeção de retry ~1897-1950, orçamento de 90s e failover ~2008-2110, sharding `SERVIDOR_SHARD_SIZE` ~1551-1600).
- Refila: `monitor-servidor/falhasRefila.js` + tabela `execucoes_servidor_falhas`.
- Nenhuma mudança em regras de validação parte/advogado nem na deduplicação.

## Ordem sugerida
Subir VPS 4 e 5 → observar um dia de rodadas com 13 pistas → aplicar itens 2, 3 e 4 (controle de retry) → itens 5 e 6.