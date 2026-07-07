## Correção do diagnóstico

Você está certo — reli o código. `persistirResgatesOutraCoordenacao` está **definida mas nunca é chamada** em `monitor-servidor/engines/paralela.js` (só `buscarPublicacoesJaEncontradasEmOutraCoordenacao` aparece dentro dela mesma). Ou seja, o resgate cross‑coordenação no DJEN Termos Servidor está mesmo desabilitado. Descarto essa hipótese.

## O que a API entrega hoje (confirmado agora)

Consultei a API PJE Comunica via as duas VPS do próprio pool (`djen-google3` e `djen-google4`) com o mesmo filtro do seu link. O item `id 661811046` volta assim:

```
"numero_processo": "40289773320268260224"   ← string, populada
"numeroprocessocommascara": "4028977-33.2026.8.26.0224"
"destinatarios":          [ { "nome": "SIGILO", ... } ]
"destinatarioadvogados":  [ OSMAR (OAB SP 310314), CAIO ]
"texto": "<p>Processo sigiloso</p>..."
```

Logo, o número **existe** no payload para essa publicação sigilosa. O motor Servidor gravou NULL mesmo assim, e nas 4 linhas (uma por coordenação) o padrão é **idêntico**: `processo_numero=NULL`, `advogados_json=[]`, `partes_json` apenas com o `SIGILO`. Cada uma dessas coordenações fez sua própria chamada — não houve resgate — então cada uma processou o mesmo item da API e perdeu o campo de forma consistente.

Duas hipóteses ainda em aberto para o motor perder o campo (irrelevante para a UI: o efeito é o mesmo):
1. instabilidade momentânea da API às ~09:16–09:36 devolvendo `numero_processo` vazio nesse item (a API PJE Comunica é conhecidamente instável);
2. bug no caminho de extração no momento em que a página foi processada.

O que importa é: quando reconsultamos a mesma API agora, o número volta. Então dá para **enriquecer o registro depois**.

Bug lateral encontrado (mesma execução, mesmo item): `sanitizeMetadataArray` filtra `destinatarioadvogados` porque cada item da API tem shape `{ id, advogado_id, advogado: { nome, numero_oab, uf_oab } }` — o `nome` está aninhado dentro de `advogado`, mas a sanitização só olha `item.nome / item.nomeAdvogado / item.nomeParte / item.name`. Todos os advogados de itens sigilosos (e provavelmente de qualquer item vindo por `destinatarioadvogados`) caem fora. Por isso `advogados_json=[]`. Isso é corrigível junto.

## Plano de correção (backend somente)

### 1. Enriquecimento pós‑execução via API PJE Comunica

Nova função em `monitor-servidor/engines/paralela.js`:
`enriquecerPublicacoesFaltantesDaExecucao(sb, execucaoId, log)`, chamada uma vez ao final do loop de `paralela.js` (após todos os `persistPublicacoes` da execução).

Fluxo:

```text
1. SELECT id, id_djen, tribunal, data_disponibilizacao, monitoramento_id
   FROM publicacoes_djen_servidor
   WHERE execucao_id = <execId>
     AND processo_numero IS NULL
     AND id_djen IS NOT NULL

2. Agrupar por (tribunal, data_disponibilizacao, monitoramento) —
   1 request por grupo, respeitando PAGE_DELAY_MS já usado no motor.

3. Para cada grupo, refazer 1 chamada à API PJE Comunica via
   djenFetchSlot(slot, baseParams(mon, dia, tribunal), signal)
   (mesma pool djen_proxy_pool, mesmo delay, mesmo retry).

4. Indexar itens por id (= id_djen) e, para cada linha NULL, UPDATE:
     - processo_numero  = item.numero_processo
     - advogados_json   = destinatarioadvogados normalizado (se atualmente [])
     - orgao/tipo_comunicacao/meio  = valores da API se atualmente NULL

5. Não mexer em publicacoes_djen diretamente: o trigger
   ensure_processo_numero_djen já roda em UPDATE OF processo_numero
   e o mirror já propaga campos para a tabela unificada.
```

Custo: 1 chamada extra por grupo (data, tribunal, monitoramento) — só quando há sobra NULL. Em execução normal (sem NULLs), zero chamadas.

### 2. Correção do parser de `destinatarioadvogados`

Em `sanitizeMetadataArray` (linha 285): quando o item tem `advogado` aninhado (shape do PJE Comunica), extrair `item.advogado?.nome`, `item.advogado?.numero_oab` e `item.advogado?.uf_oab` para o objeto de saída. Assim `advogados_json` deixa de ficar vazio nas sigilosas e em qualquer publicação onde a API só devolve `destinatarioadvogados`. Isso também recupera o número no fluxo normal: `advogados_json` volta a ter conteúdo utilizável na UI.

### 3. Backfill único do histórico

Edge function `djen-backfill-processo-numero` (executada pontualmente) que faz o mesmo trabalho do item 1, mas cobrindo os últimos 30 dias:

```text
- Lista linhas com processo_numero IS NULL e id_djen definido.
- Agrupa por (tribunal, dia, monitoramento).
- Reusa buscarTermo/buscarPaginado da paralela (import direto).
- Atualiza processo_numero + advogados_json + partes_json quando faltando.
```

Executada uma vez para limpar os 4 registros do OSMAR de hoje e qualquer outro passivo do mesmo tipo. Sem cron: chamada manual pela UI de admin já existente.

### 4. UI

Nenhuma mudança. Assim que o banco preenche `processo_numero`, a Análise DJEN já exibe.

## Arquivos afetados

- `monitor-servidor/engines/paralela.js`
  - nova função `enriquecerPublicacoesFaltantesDaExecucao` + chamada no fim do loop principal (linha ~1752 depois de `persistPublicacoes`).
  - ajuste em `sanitizeMetadataArray` para desaninhar `item.advogado`.
- Nova edge function `supabase/functions/djen-backfill-processo-numero/index.ts`.
- Sem mudança de schema, sem mudança de frontend.

## Observações técnicas

- Nenhum resgate cross‑coordenação é adicionado; o enriquecimento age só na coordenação que já persistiu o registro.
- O trigger `ensure_processo_numero_djen` fica intacto — continua servindo como último recurso pelo texto/Kurier.
- Para monitoramentos com `uf=TODAS`, o re‑fetch usa `nomeAdvogado` puro (sem OAB+UF), que confirmamos devolver o número em sigilosos.
