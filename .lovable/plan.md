# DJEN Termos Servidor — falha "HTTP 403" derruba o termo do dia

## O que está acontecendo

O erro que apareceu não é queda da nossa VPS. A VPS 3 está no ar e saudável (respondeu `{"ok":true}` no teste agora). O 403 vem da API do DJEN (PJE Comunica), que bloqueia temporariamente o IP de uma VPS quando ela consulta demais — a página de erro devolvida não é do nosso nginx (o nosso responde com `nginx/1.22.1`; a do erro vem sem versão, é do lado do PJE).

Verificado no banco: as rodadas do motor servidor começaram a registrar 403 em 01/09 às 20h e desde então quase toda rodada tem alguma ocorrência, sempre em VPS diferentes (2.1, 3, 7, 8) — mais um sinal de bloqueio por IP no destino, não de configuração nossa.

O problema real é o comportamento do motor: hoje, quando uma consulta leva 403, ele assume que é "token errado daquela VPS", desiste na hora e **não tenta a mesma busca em outra VPS**. Resultado: o termo daquele dia (ex.: "PROTEGE") fica sem coleta, como mostra o aviso.

## Correção proposta

No motor do servidor (`monitor-servidor`):

1. Tratar 403 como bloqueio temporário de IP, e não como erro de credencial: colocar a VPS em descanso curto e **repetir a mesma consulta em outra VPS do pool** (até 2 trocas), antes de dar a busca como perdida.
2. Manter 401 com o comportamento atual (aí sim é token errado — não adianta tentar outra VPS).
3. Quando todas as tentativas falharem, registrar o par termo × dia na fila de refazer, para a rodada seguinte recuperar automaticamente (já existe esse mecanismo; hoje o 403 não chega bem sinalizado até ele).
4. Ajustar a mensagem exibida no card para algo legível — "DJEN bloqueou temporariamente o acesso (403); repetido em outra VPS" — em vez de despejar o HTML do erro.

## Detalhes técnicos

- `monitor-servidor/proxyPool.js` — em `djenFetchSlot`, separar 401 de 403: no 403, aplicar `cooldownUntil` no slot (como já é feito no 429) e devolver um erro tipado (`kind: "ip_block"`) em vez do texto HTML cru.
- `monitor-servidor/engines/paralela.js` — em `fetchWindow`/`buscarPaginado`, o ramo `kind === "auth"` passa a distinguir: 401 falha direto (comportamento atual); 403 refaz a janela via `pickNext` em outro slot (limite de 2 trocas, com jitter), e só falha se esgotar.
- Normalizar a mensagem de erro antes de gravar em `progresso.itens[].erro` e `erroDetalhes[].erro` (hoje entra o HTML do nginx truncado).
- Nada muda no banco, nas VPS, na Carga Benner nem no frontend além do texto exibido.

## Observação de implantação

O `monitor-servidor` roda na VPS Hostinger (worker `hostinger-01`); depois de aprovado, a alteração precisa ser puxada e o daemon reiniciado lá para valer.
