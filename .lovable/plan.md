# Monitoramento Servidor — dois erros distintos (DJEN 403 e Kurier 546)

## 1) DJEN Termos: trocar de VPS adianta?

Entre as VPS do Google, **não**. Os dados mostram bloqueio da faixa de IPs do Google Cloud, não de uma máquina:

- Os 403 começaram todos no mesmo instante — 01/09 às 20h — e se repetem em todas as rodadas desde então.
- Últimos 3 dias: Google VPS 3 (125), VPS 7 (119), VPS 8 (117), VPS 9 (117), VPS 12 (116), VPS 2.1 (101).
- **Hostinger VPS 1: nenhum 403.**

O erro é novo mesmo e veio de fora: o PJE Comunica passou a barrar requisições vindas do Google Cloud. As VPS estão no ar e saudáveis (VPS 3 respondeu `{"ok":true}` no teste agora) e o token está correto — a página de erro não é do nosso nginx (o nosso responde com versão `nginx/1.22.1`; a do erro vem sem versão, do lado do PJE).

Então o caminho não é girar entre as Google, e sim tirar o tráfego da faixa bloqueada.

### O que fazer

1. **Priorizar IPs fora do Google.** Marcar o provedor de cada VPS no pool e dar preferência às não-Google (hoje só a Hostinger). Em 403, refazer a consulta em VPS de outro provedor em vez de desistir do termo.
2. **Bloqueio por provedor, não por máquina.** Detectado 403 numa Google, o grupo inteiro entra em descanso por alguns minutos.
3. **Não perder o termo do dia.** Hoje o motor trata 403 como "token errado" e falha na hora; passa a registrar o par termo × dia na fila de refazer, recuperado na rodada seguinte.
4. **Mensagem legível no painel**: "DJEN bloqueou o IP (403) — repetido por outra via", em vez do HTML do erro.
5. **Capacidade fora do Google (recomendado em seguida).** Só a Hostinger não sustenta o volume. Vale subir 2–3 VPS em outro provedor e cadastrá-las no pool — é o que realmente resolve enquanto o PJE mantiver o bloqueio da faixa Google.

## 2) Kurier: HTTP 546 WORKER_RESOURCE_LIMIT

Esse erro é diferente e não tem relação com o DJEN: 546 é a Supabase encerrando a função por estouro de recurso (memória/CPU/tempo) durante a execução. Acontece nas credenciais com fila grande (`paixaoc`, `paixaoc.02`) e não nas menores (`paixaocortes.df` concluiu com 261 novas) — bate com acúmulo de trabalho numa única chamada.

Hoje o worker pede até 5 lotes de 50 publicações numa só invocação (a função aceita até 20), e cada publicação carrega texto integral, partes e advogados na memória até o fim.

### O que fazer

1. **Fatiar a invocação:** o worker passa a chamar a função com 1–2 lotes por vez e repetir até a fila da credencial esvaziar (com teto de chamadas por rodada), em vez de uma chamada longa.
2. **Tratar 546 como recuperável:** ao receber 546, repetir a mesma credencial com metade dos lotes; só registra falha se persistir no menor tamanho.
3. **Reduzir consumo por lote:** liberar os textos já gravados a cada lote e remover o log de amostra do payload (imprime até 1500 caracteres por rodada).
4. Se mesmo assim estourar, cair para lotes de 25 publicações nas credenciais grandes.

## Detalhes técnicos

DJEN:
- `djen_proxy_pool`: marcação de provedor (derivada do `base_url` ou coluna nova) para agrupar VPS.
- `monitor-servidor/proxyPool.js`: em `djenFetchSlot`, separar 401 (token, falha direto) de 403 (bloqueio de IP, erro tipado); `markFail` aplica cooldown ao grupo; `pickNext` prioriza grupos sem bloqueio recente.
- `monitor-servidor/engines/paralela.js`: no ramo `kind === "auth"`, 403 refaz a janela em outro slot (preferindo outro provedor, até 2 trocas) e a falha final entra em `falhasRefila`; normalizar a mensagem gravada em `progresso.itens[].erro` e `erroDetalhes[].erro`.

Kurier:
- `monitor-servidor/engines/kurier.js`: `invokeKurier` em laço por credencial com `max_lotes` pequeno, parando quando a resposta indicar fila vazia; `catch` específico para 546 com redução de lotes.
- `supabase/functions/kurier-consultar-publicacoes/index.ts`: remover o `console.log` de amostra do payload (linha ~895), limpar acumuladores por lote e permitir `LOTE_SIZE` reduzido via parâmetro.

## Implantação

O `monitor-servidor` roda na VPS Hostinger (worker `hostinger-01`): após aprovado, é preciso puxar a alteração lá e reiniciar o daemon. A edge function do Kurier é implantada automaticamente.
