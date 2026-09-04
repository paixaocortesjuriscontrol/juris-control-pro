# DJEN Termos: 403 do DJEN derrubando termos sem coleta

## O que está acontecendo (confirmado nos testes de agora)

O `403 Forbidden ... nginx` **não vem da nossa VPS**. Testei a Google VPS 3 (e 4 e 5) direto:

- `/health` responde `200 {"ok":true,"service":"djen-comunica-proxy"}` — a VPS está viva;
- `/djen` sem token responde `401 {"error":"unauthorized"}` em JSON — ou seja, quando o problema é token, a resposta é JSON nosso, não HTML de nginx.

O proxy repassa a resposta do DJEN embrulhada (`{status, body}`). Aquele HTML de nginx com o comentário "padding to disable MSIE and Chrome friendly error page" é a página de bloqueio do **próprio comunicaapi.pje.jus.br** (WAF do DJEN) contra o IP daquela VPS — um bloqueio temporário, primo do 429.

O motor, porém, classifica qualquer 403 como `auth` (token errado da VPS). Nesse caminho ele:

- não repete a janela, não espera, não degrada o tamanho de página;
- marca a VPS como falha e, após 3 falhas, tira a via do pool por 60s;
- entrega a unidade (termo × tribunal × dia) como falha → é isso que vira "16 termo(s)/dia sem coleta".

Ou seja: um bloqueio passageiro do DJEN está sendo tratado como erro fatal de configuração.

## O que vou mudar

1. **Separar 403 do DJEN de 403 nosso.** Se o corpo for HTML/página de bloqueio do upstream, classificar como bloqueio temporário; só tratar como `auth` quando a resposta for o erro JSON do nosso proxy (`unauthorized` / `host_not_allowed`).
2. **Bloqueio temporário passa a ser tratado como rate limit:** espera com backoff, repete a mesma janela, e se persistir tenta outra VPS do pool (o failover que já existe) antes de dar a unidade como perdida.
3. **Cooldown da via em vez de morte:** VPS que tomou 403 do DJEN entra em cooldown curto (como no 429) e volta ao rodízio, em vez de acumular falha e sair do pool por 60s.
4. **Log e contador corretos:** a mensagem passa a dizer "bloqueio temporário do DJEN (403) na Google VPS X" e conta em rate limit, não em erro de autenticação — assim a tela para de sugerir problema de token.

Efeito prático: termos como "SI DISTRIBUIDORA" que hoje ficam sem coleta passam a ser recuperados na mesma rodada por outra via, e só sobram como falha se todas as vias estiverem bloqueadas.

## Detalhes técnicos

- `monitor-servidor/proxyPool.js`: em `djenFetchSlot`, inspecionar o corpo antes de decidir; upstream-403 → `markFail(url, "429")` (cooldown) e devolver o `out` para o chamador tratar, em vez de `throw` imediato. 401/403 de proxy (JSON) mantém o comportamento atual.
- `monitor-servidor/engines/paralela.js`: em `fetchWindow`/`buscarPaginado`, novo `kind: "bloqueio"` compartilhando o caminho do `429` (pausa `RATE_LIMIT_PAUSE_MS` + repetição da janela) e contando em `METRICS.c429`; `kind: "auth"` continua sem degradação.
- `src/utils/djenProxyPool.ts`: aplicar a mesma classificação para o motor no navegador, mantendo paridade Servidor/Browser.
- Sem migração de banco e sem mudança em duplicados, descartes ou persistência.

## Fora de escopo

Ajuste de concorrência/orçamento do motor paralelo e mudanças no pool de VPS (habilitar/desabilitar slots) ficam para depois, se o 403 persistir mesmo com o failover.
