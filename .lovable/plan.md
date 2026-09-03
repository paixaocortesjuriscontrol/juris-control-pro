# DJEN Termos Servidor — 403 do PJE nas VPS do Google

## Respondendo direto: trocar de VPS adianta?

Entre as VPS do Google, **não**. Os dados mostram bloqueio da faixa de IPs do Google Cloud, não de uma máquina:

- Os 403 começaram todos no mesmo instante — 01/09 às 20h — e desde então se repetem em todas as rodadas.
- Nos últimos 3 dias: Google VPS 3 (125), VPS 7 (119), VPS 8 (117), VPS 9 (117), VPS 12 (116), VPS 2.1 (101).
- **Hostinger VPS 1: nenhum 403.**

Ou seja: o erro é novo mesmo (não acontecia antes de 01/09) e veio de fora — o PJE Comunica passou a barrar requisições vindas do Google Cloud. Nossas VPS estão no ar e saudáveis (a VPS 3 respondeu `{"ok":true}` no teste agora) e o token está correto; a página de erro não é do nosso nginx (o nosso responde com versão `nginx/1.22.1`; a do erro vem sem versão, do lado do PJE).

Portanto o caminho não é "girar entre as Google", e sim **tirar o tráfego da faixa bloqueada**.

## Plano

1. **Rotear o DJEN Termos por IPs fora do Google.** Marcar no pool o provedor de cada VPS e dar prioridade às não-Google (hoje só a Hostinger). Quando uma consulta levar 403, refazer em uma VPS de outro provedor em vez de desistir do termo.
2. **Bloqueio por provedor, não por máquina.** Ao detectar 403 em uma VPS Google, colocar o grupo inteiro em descanso por alguns minutos, para não queimar tempo tentando 6 máquinas na mesma faixa bloqueada.
3. **Não perder o termo do dia.** Hoje o motor trata 403 como "token errado" e falha na hora. Passa a registrar o par termo × dia na fila de refazer, para a rodada seguinte recuperar automaticamente.
4. **Mensagem legível no painel.** Em vez do HTML do erro, mostrar "DJEN bloqueou o IP (403) — repetido por outra via".
5. **Capacidade fora do Google (recomendado em seguida).** Só a Hostinger não sustenta o volume atual. Vale subir 2 a 3 VPS em outro provedor (Hostinger/Contabo/OVH) e cadastrá-las no pool — isso é o que efetivamente resolve enquanto o PJE mantiver o bloqueio da faixa Google.

## Detalhes técnicos

- `djen_proxy_pool` ganha uma marcação de provedor (derivada do `base_url` ou coluna nova) para agrupar as VPS.
- `monitor-servidor/proxyPool.js`: em `djenFetchSlot`, separar 401 (token — falha direto) de 403 (bloqueio de IP — devolve erro tipado); `markFail` aplica cooldown ao grupo do provedor; `pickNext` prioriza grupos sem bloqueio recente.
- `monitor-servidor/engines/paralela.js`: no ramo `kind === "auth"`, o 403 refaz a janela em outro slot (preferindo outro provedor, até 2 trocas) antes de falhar, e a falha final entra em `falhasRefila`.
- Normalizar a mensagem gravada em `progresso.itens[].erro` e `erroDetalhes[].erro`.
- Sem mudanças no frontend além do texto exibido; nada na Carga Benner.

## Implantação

O `monitor-servidor` roda na VPS Hostinger (worker `hostinger-01`): após aprovado, é preciso puxar a alteração lá e reiniciar o daemon.
