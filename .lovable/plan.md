
# Correção — DJET Pautas do DJEN Servidor com volume baixo

## Diagnóstico (o que está acontecendo hoje, 06/07/2026 — segunda-feira)

Rodadas de hoje em `execucoes_agendadas` (tipo=`djet_pautas`):

| Horário (UTC) | Modo      | Novas | Dup | TRTs com achado                       |
| ------------- | --------- | ----- | --- | ------------------------------------- |
| 12:00         | servidor  | 4     | 10  | TRT3, TRT4, TRT20, TRT23, TRT24       |
| 12:30         | browser   | 4     | 10  | idem                                  |
| 16:00         | servidor  | 0     | 14  | mesmos, todos dup                     |
| 16:25         | browser   | 0     | 14  | mesmos, todos dup                     |

Nos logs de `buscar-dejt-pautas` os PDFs baixam OK e são lidos ("TRT23 06/07/2026 p1-100/58: 4 blocos, **21 match(es)**"; "TRT21 p1-100/21: 15 blocos, **0 match(es)**"). Ou seja, **os PDFs vieram, o pdf.js lê, mas o volume caiu de ~200/dia para 4**.

Causa raiz identificada em `supabase/functions/buscar-dejt-pautas/index.ts` (função `fetchPdf`) + `_shared/dejtTribunais.ts`:

- A única URL usada é o caminho fixo `https://diario.jt.jus.br/cadernos/Diario_J_<ID>.pdf`. Esse endpoint **serve só o caderno vigente**, e por regra prática do DEJT **alguns TRTs (principalmente TRT1/TRT2/TRT5/TRT15 e demais grandes) só têm o caderno de segunda-feira publicado depois das 13–14h BRT**. Nossos slots agendados rodam 09:00, 09:30, 13:00 e 13:25 BRT.
- Hoje o código faz `res.headers.get("last-modified")` **mas nunca compara com a data pedida** — se o servidor devolve o PDF de sexta (03/07) no request de segunda (06/07), a função aceita como se fosse o caderno de hoje. O motor então extrai as pautas de sexta, calcula os mesmos hashes de sexta, e o `persistMatches` marca tudo como duplicata. É exatamente o que vemos em TRT23 (21 matches → 9 dedup local → 0 novas / 9 dup) e TRT20.
- `runJob` (`executar-djet-pautas-agendado`) também não distingue "PDF veio de outro dia" de "PDF é de hoje sem matches": ambos aparecem como `Concluído · 0 nova(s)` no painel, com `diasSemPdf: 0`. Isso mascara o problema no acompanhamento visual.

Ou seja: o volume real de hoje deve ser bem maior — só que o motor está lendo o caderno do dia útil anterior nos TRTs que ainda não publicaram, achando tudo duplicado e reportando "0 nova(s)".

## Alterações

### 1) `supabase/functions/buscar-dejt-pautas/index.ts` — validar `Last-Modified`

Em `fetchPdf`, depois de baixar o PDF e antes de retornar `{ ok: true, bytes }`, comparar o header `Last-Modified` com a data pedida em BRT:

- Converter `dataDDMMYYYY` para meia-noite BRT (UTC-3).
- Parsear `Last-Modified` como Date.
- Se `lastMod < requestedDayStartBrt` → retornar `{ ok: false, reason: "caderno-nao-atualizado", lastModified }` (não descartar por erro, apenas sinalizar).
- Se o header vier ausente/inválido, manter comportamento atual (aceitar), mas anexar `lastModified: null` no log.

Efeito: PDFs "de ontem servidos como vigente" deixam de virar dup silencioso — passam a ser sinalizados como sem-caderno-do-dia, exatamente como já fazemos para sábado/domingo.

### 2) `supabase/functions/executar-djet-pautas-agendado/index.ts` — propagar o motivo real

Em `runJob`, dentro do loop de `pageStart`, quando a resposta do `buscar-dejt-pautas` vier com `sem_dados: true` e `motivo === "caderno-nao-atualizado"`:

- `item.diasSemPdf += 1`.
- `item.mensagem = "Caderno ainda não publicado (last-modified: <data>)"`.
- Não conta como erro, não incrementa `totalErros`.
- Permite outra rodada mais tarde pegar o caderno atualizado (já temos até 3 slots no `metadata.horarios_por_dia`).

Também expor `motivo` e `lastModified` no payload do primeiro chunk (o código já lê `json.numPages` do primeiro chunk — vamos ler `json.motivo` também e sair do loop de chunks se for `caderno-nao-atualizado`).

### 3) `supabase/functions/executar-djet-pautas-agendado/index.ts` — gravar `tribunal` na pauta

`persistMatches` monta `base` sem o campo `tribunal`, então `publicacoes_djen.tribunal` está NULL em todas as pautas. Incluir `tribunal: m.tribunal` no `base` (ambos os modos, browser e servidor). Facilita diagnóstico futuro por tribunal em SQL e no painel.

### 4) Ajuste opcional de horários — recomendação

O agendamento hoje roda 06:00/09:00/13:00 BRT (`configuracoes_monitoramento_servidor.horarios_execucao` de `djet_pautas_servidor`). Para não perder cadernos de TRTs grandes que só publicam à tarde, incluir também **um slot 16:30 BRT** (via metadata `horarios_por_dia`). **Não vou aplicar isso agora** — é uma mudança de configuração que a Dra. precisa aprovar (custo de créditos). Deixo indicado.

## Detalhes técnicos

- `Last-Modified` do `diario.jt.jus.br` já vem no formato HTTP-date padrão ("Mon, 06 Jul 2026 12:34:56 GMT"), `new Date(header)` resolve. Se retornar `Invalid Date`, cair no comportamento antigo (aceitar).
- Nova razão `"caderno-nao-atualizado"` — o front do painel de execução já lista `mensagem` do item, então basta o texto claro; não precisa de nova classe.
- Nenhuma migração de banco. Só código de edge function e ajuste do inserto para preencher `tribunal`.
- Backfill do `tribunal` nas pautas antigas não é necessário para o objetivo dessa correção; podemos rodar depois se quiser (script separado).

## Verificação

1. `curl` no endpoint TRT1 (`https://diario.jt.jus.br/cadernos/Diario_J_01.pdf`) e conferir `Last-Modified`. Se estiver em 03/07/2026, comprova o diagnóstico.
2. Após deploy, disparar `executar-djet-pautas-agendado` com `{ "force": true }`. Esperado: TRTs cujo caderno ainda não subiu para hoje aparecem como "Caderno ainda não publicado" com `diasSemPdf ≥ 1`, e não como "Concluído · 0 nova(s)".
3. Rodar novamente após 14h BRT e conferir que os mesmos TRTs agora achem matches (assumindo cadernos publicados).
