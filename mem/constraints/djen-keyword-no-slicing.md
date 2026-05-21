---
name: DJEN palavra-chave nunca fatia o termo
description: Busca DJEN palavra-chave envia sempre a expressão inteira; nunca substring/2-primeiras-palavras
type: constraint
---
A busca por `palavra-chave` no DJEN (motores Pro, Flash, Paralela, BuscaDireta, Sincronizar, WorkerVps) deve enviar a EXPRESSÃO INTEIRA configurada no termo, apenas normalizada sem acentos. NUNCA fatiar em 2 palavras nem usar apenas palavra mais longa de um `+`.

Exemplos:
- Termo `UNIÃO QUÍMICA` → API recebe `UNIAO QUIMICA`. Match aceita `UNIÃO QUÍMICA FARMACÊUTICA`.
- Termo `SEU ZÉ` → API recebe `SEU ZE`. Match aceita `SEU ZÉ MANÉ`.

A validação local continua exigindo frase exata na ordem com fronteira de palavra (`contemFrase`/`contemFraseExata`). Isso evita que `UNIÃO QUÍMICA` case com texto que tem só `QUÍMICA`.

Função `encurtarParaApi` em useDjenTermos{Pro,Flash,Paralela}Engine.ts: apenas remove acentos e trim — NÃO trunca.

Função `gerarVariantes` em `useDjenTermosEngine.ts` e `useSincronizarDjenBrowser.ts`: pode produzir apenas variantes de normalização (sem acento, sem `&`). É PROIBIDO gerar variante "curta"/"prefixo" com `slice(0, 2)` das palavras significativas — isso fatia o termo e contradiz a regra.
