# Kurier — corrigir o erro HTTP 546 (WORKER_RESOURCE_LIMIT)

## O que está acontecendo

546 é a Supabase encerrando a função no meio da execução por estouro de recurso (memória/CPU/tempo). Acontece nas credenciais com fila grande (`paixaoc`, `paixaoc.02`) e não nas menores (`paixaocortes.df` concluiu com 261 novas, 7 duplicadas) — o padrão bate com acúmulo de trabalho numa única chamada, não com erro do Kurier em si.

Hoje o worker pede até 5 lotes de 50 publicações por invocação (a função aceita até 20), e cada publicação carrega texto integral, partes e advogados em memória até o fim da chamada.

## Correção

1. **Fatiar a invocação:** o worker passa a chamar a função com 1–2 lotes por vez e repetir até a fila da credencial esvaziar, com teto de chamadas por rodada — em vez de uma chamada longa.
2. **Tratar 546 como recuperável:** ao receber 546, repetir a mesma credencial com metade dos lotes; só registra falha se persistir no menor tamanho.
3. **Reduzir consumo por lote:** liberar os acumuladores de texto depois de gravar cada lote e remover o log de amostra do payload (imprime até 1500 caracteres por rodada).
4. **Plano B para as credenciais grandes:** permitir lote de 25 publicações em vez de 50 quando o 546 reaparecer.

Nada muda no DJEN Termos (o 403 das VPS é outro assunto, fica para depois), nem no banco, nem na Carga Benner.

## Detalhes técnicos

- `monitor-servidor/engines/kurier.js`: `invokeKurier` passa a rodar em laço por credencial com `max_lotes` pequeno (env `KURIER_LOTES_POR_CHAMADA`, default 2), parando quando a resposta indicar fila vazia ou ao atingir o teto de chamadas; `catch` específico para status 546 reduzindo `max_lotes` pela metade antes de registrar falha em `falhasRefila`.
- `supabase/functions/kurier-consultar-publicacoes/index.ts`: remover o `console.log` de amostra do payload (~linha 895); zerar arrays de junção/textos ao final de cada lote; aceitar `lote_size` no body (default 50, mínimo 25) aplicado a `LOTE_SIZE`; devolver na resposta um indicador explícito de "fila esvaziada" para o worker saber quando parar.

## Implantação

A edge function do Kurier é implantada automaticamente. O `monitor-servidor` roda na VPS Hostinger (worker `hostinger-01`): a alteração precisa ser puxada lá e o daemon reiniciado.
