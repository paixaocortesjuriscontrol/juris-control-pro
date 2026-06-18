## Objetivo

Unificar a gravação do Kurier (browser e servidor) sempre em `publicacoes_djen` e recuperar imediatamente as 606 publicações capturadas hoje que ficaram em `publicacoes_djen_servidor`.

## Mudanças

### 1. Edge function `kurier-consultar-publicacoes`

Forçar Kurier a sempre gravar em `publicacoes_djen`, independente do `persist_mode` recebido. Alteração mínima em `supabase/functions/kurier-consultar-publicacoes/index.ts` (linhas 307–308):

```ts
// Kurier sempre persiste em publicacoes_djen (tabela canônica da Análise DJEN).
// O parâmetro persist_mode é ignorado de propósito — manter compatibilidade
// só com a tabela do "browser" para não furar dedup/leituras/alertas.
const persistMode: "browser" = "browser";
const pubTable = "publicacoes_djen";
```

Também removo o campo `origem: "servidor"` que era adicionado quando `persistMode==="servidor"` nos dois inserts (linhas ~767 e ~815) — fica apenas o spread do `basePayload`.

Não preciso mexer em `monitor-servidor/engines/kurier.js`; o body continua mandando `persist_mode: "servidor"` mas a edge function ignora.

### 2. Migração dos dados de hoje

Migração SQL via tool de insert (DML, não DDL):

- Copiar de `publicacoes_djen_servidor` para `publicacoes_djen` todas as 606 linhas com `created_at::date = CURRENT_DATE`, mapeando colunas comuns, definindo `fonte = 'kurier'`, `status = 'encontrada'` e `lida = false`.
- Usar `ON CONFLICT DO NOTHING` para evitar duplicar caso algum hash já exista.
- Depois, apagar de `publicacoes_djen_servidor` as linhas migradas (mesmo recorte de data) para não ficar resíduo confundindo relatórios.

```sql
INSERT INTO public.publicacoes_djen
  (id, monitoramento_id, hash_conteudo, data_publicacao, data_disponibilizacao,
   processo_numero, conteudo, fonte, tribunal, polo_ativo, polo_passivo,
   orgao, tipo_comunicacao, meio, advogados_json, partes_json,
   dedup_processo_digits, dedup_data_ref, dedup_head_norm, dedup_key,
   dedup_conteudo_key, coordenacao_id, tipo_publicacao, id_djen, kurier_login,
   status, lida, created_at)
SELECT id, monitoramento_id, hash_conteudo, data_publicacao, data_disponibilizacao,
   processo_numero, conteudo, 'kurier', tribunal, polo_ativo, polo_passivo,
   orgao, tipo_comunicacao, meio, advogados_json, partes_json,
   dedup_processo_digits, dedup_data_ref, dedup_head_norm, dedup_key,
   dedup_conteudo_key, coordenacao_id, tipo_publicacao, id_djen, kurier_login,
   'encontrada', false, created_at
FROM public.publicacoes_djen_servidor
WHERE created_at::date = CURRENT_DATE
ON CONFLICT DO NOTHING;

DELETE FROM public.publicacoes_djen_servidor
WHERE created_at::date = CURRENT_DATE;
```

> Observação: hoje (18/06) `publicacoes_djen_servidor` só recebeu Kurier (606 linhas, todas com `origem='servidor'`, `fonte=NULL`), então migrar tudo do dia é seguro. Confirmei isso no banco antes de propor.

## Deploy

- Edge function: deploy automático do Lovable.
- VPS: **não precisa** reiniciar `jc-monitor-servidor` — a engine continua chamando a edge function igual; só o destino interno mudou.

## Validação

1. `SELECT COUNT(*) FROM publicacoes_djen WHERE fonte='kurier' AND created_at::date=CURRENT_DATE;` deve passar de 0 para ~606.
2. `SELECT COUNT(*) FROM publicacoes_djen_servidor WHERE created_at::date=CURRENT_DATE;` deve ir para 0.
3. Abrir Análise DJEN filtrando por coordenação e ver as publicações Kurier de hoje aparecendo.
4. Rodar 1 ciclo do Kurier (manual ou esperar o próximo do cron do VPS) e confirmar que os novos registros entram em `publicacoes_djen`.
