# DJEN Pautas Servidor — por que 17/08 a 21/08 achou só 2 novas

## O que eu confirmei agora (não é suposição)

1. **O motor ignora a data pedida.** Em `_shared/dejtTribunais.ts`, a função que monta as URLs
   devolve **uma única** URL fixa por tribunal — o "caderno vigente"
   (`/cadernos/Diario_J_<ID>.pdf`). O parâmetro de data existe na assinatura, mas não é usado.
   Consequência: pedir 17/08 a 21/08 baixa **o mesmo PDF 5 vezes** por tribunal. Daí
   "2 novas e 36 duplicadas": as duplicadas são o mesmo caderno relido.

2. **A fonte está parada desde 18/08.** Consultando os cabeçalhos agora:
   - `Diario_J_TST.pdf` → last-modified **18/08/2026 21:55**, 87 KB
   - `Diario_J_02.pdf` (TRT2) → **18/08**, 160 KB
   - `Diario_J_03.pdf` (TRT3) → **17/08**, 1,2 MB
   - `Diario_J_10.pdf` (TRT10) → **18/08**, 88 KB
   Ou seja: hoje (21/08) esse caminho continua servindo a edição de 17-18/08.
   Os tamanhos também são pequenos demais para um caderno diário real do TST,
   o que reforça que esse caminho fixo não é a via oficial de download por data.

3. **A rota datada oficial está bloqueada para nós.** `dejt.jt.jus.br/dejt/downloadcaderno.do?...&data=DD/MM/YYYY`
   responde **HTTP 403 (awselb)** tanto do ambiente das Edge Functions quanto daqui —
   bloqueio de WAF por IP de datacenter, não erro de parâmetro.

4. **Histórico coerente com isso:** as pautas gravadas com fonte `dejt-pdf` param em
   18/08 (4 registros, 1 tribunal), 17/08 (25 registros, 6 tribunais), e assim por diante.
   Nada de 19, 20 ou 21/08 jamais entrou.

Resumo: **não é falha de extração nem de casamento de termos.** Funcionava "diariamente"
porque a rodada diária pegava o caderno vigente enquanto ele era do dia; desde 19/08 esse
caminho parou de avançar e o motor não tem outra via para pegar a edição por data.

## Correção proposta

### 1. Voltar a ter acesso à edição por data (é o que resolve de verdade)
- Habilitar nas VPS do pool DJEN o repasse para os hosts `dejt.jt.jus.br` e
  `diario.jt.jus.br` (hoje o proxy só encaminha para `comunicaapi.pje.jus.br`).
- Fazer o download dos cadernos **pelo pool de proxies** (IPs residenciais/VM já usados
  no DJEN), com tentativa direta primeiro e proxy no 403.
- Primeira etapa é uma sondagem pelo proxy: para 20/08 e 21/08, testar
  `downloadcaderno.do` e os padrões datados em TST + 2 TRTs. Só depois de um 200 com `%PDF`
  o motor passa a usar a rota datada.
- Se nem pelo proxy houver rota datada, o motor fica limitado ao caderno vigente e isso
  passa a ser dito claramente no painel (item 2), sem prometer o que a fonte não entrega.

### 2. Painel honesto (independente do item 1)
- Quando o range pedido não existe na fonte, mostrar
  `Fonte serve edição 18/08 — dias 19/08 a 21/08 indisponíveis` em vez de contar duplicadas.
- Não somar como "duplicadas" releituras do mesmo caderno dentro da mesma rodada:
  baixar o caderno vigente **uma vez** por tribunal por rodada, não uma vez por dia do range.

### 3. Alerta ao suporte
- E-mail diário para `suporte@paixaocortes.adv.br` quando a edição vigente de qualquer
  tribunal estiver mais de 2 dias úteis atrás da data corrente, com a lista de tribunais
  e o `last-modified` de cada caderno — para a defasagem não passar mais dias invisível.

## Detalhes técnicos

- `supabase/functions/_shared/dejtTribunais.ts`: `buildDejtPdfUrls` volta a retornar lista
  ordenada (candidatos datados → vigente), usando de fato `dataDDMMYYYY`.
- `supabase/functions/buscar-dejt-pautas/index.ts`: `fetchPdf`/proxy passam a tentar o pool
  (`djen_proxy_pool`) em 403/blocked; guardas `%PDF` e `MAX_PDF_BYTES` mantidos.
- `supabase/functions/executar-djet-pautas-agendado/index.ts`: deduplicar o loop de dias
  quando a URL resolvida for a mesma (evita as 36 "duplicadas") e propagar o motivo real
  para a mensagem do tribunal.
- VPS: ajustar `djen-proxy/server.js` para aceitar upstream por host permitido em allowlist,
  em vez do `UPSTREAM` fixo. Requer redeploy nas VMs do pool.
- Sem mudança de schema.
