## Objetivo

Corrigir 2 causas reais de divergência DJEN Browser × Servidor:

1. **Data normalizada em horário Brasília** — Servidor grava `00:00 UTC`, que vira 23/06 21:00 BRT e o comparador joga em outro dia (falso "só_servidor" do `650569963` da Vanessa TST).
2. **Cobertura de busca por advogado quando `uf=TODAS`** — a chamada única `numeroOab=15553 + ufOab=TODAS + nomeAdvogado=OSMAR` está perdendo publicações regionais que a API devolve quando consultada apenas por `nomeAdvogado`. Caso confirmado: 1 publicação TJMG do processo 5004003-83.2023.8.13.0319 (a que tem OSMAR em `destinatarioadvogados` com OAB MG-164494/DF-15553) ficou de fora da coord Thomás.

**Fora de escopo, conforme alinhamento:**
- Kurier no Servidor.
- Validação por conteúdo bruto (campo "Adv ‑ ..."): publicações que só citam o advogado no texto não devem ser capturadas pelo tipo `advogado`. As outras 3 pubs TJMG do mesmo processo permanecem corretamente fora da coord Thomás.
- Lado Browser.

---

## Mudanças

### 1. Normalizar `data_disponibilizacao` para BRT 12:00
**Arquivo:** `monitor-servidor/engines/paralela.js`

- Em `persistPublicacoes` e `registrarDescartadaServidor`, gravar `data_disponibilizacao` como `YYYY-MM-DDT12:00:00-03:00` (= `15:00:00Z` em UTC), reaproveitando `nextBusinessDateYmd` para a parte da data.
- Chave única `(coordenacao_id, id_djen)` não é afetada.

### 2. Backfill (UPDATE, sem schema)

```sql
UPDATE publicacoes_djen_servidor
SET data_disponibilizacao = date_trunc('day', data_disponibilizacao AT TIME ZONE 'UTC') + interval '15 hours'
WHERE data_disponibilizacao >= now() - interval '30 days'
  AND EXTRACT(HOUR FROM data_disponibilizacao AT TIME ZONE 'UTC') = 0;

UPDATE publicacoes_djen_descartadas
SET data_disponibilizacao = date_trunc('day', data_disponibilizacao AT TIME ZONE 'UTC') + interval '15 hours'
WHERE data_disponibilizacao >= now() - interval '30 days'
  AND EXTRACT(HOUR FROM data_disponibilizacao AT TIME ZONE 'UTC') = 0;
```

### 3. Suplemento por nome quando `uf=TODAS` (advogado com OAB)
**Arquivo:** `monitor-servidor/engines/paralela.js`

- Para `tipo=advogado` com `oab` preenchida **e `uf=TODAS`**, além da chamada `numeroOab + ufOab=TODAS + nomeAdvogado`, executar chamada complementar **apenas por `nomeAdvogado`** (sem OAB) e mesclar por `id_djen`.
- Validação segue exclusivamente via metadados estruturados (`destinatarioadvogados[].advogado.nome` normalizado vs termo normalizado) — **sem ler `conteudo`**.
- Aplicar `parsearTermoOr` (suporta `310314/OSMAR MENDES PAIXAO CORTES`).
- Respeitar `delay_between_variants` entre as duas chamadas.

Resultado: a pub TJMG `649843498` (única do processo com OSMAR em `destinatarioadvogados`) passa a ser capturada na coord Thomás. As outras 3 do mesmo processo seguem fora — correto.

---

## Validação

Após `git pull` + `pm2 restart jc-monitor-servidor`:

1. **Data:** comparador deixa de listar `650569963` como "só_servidor" para Vanessa TST.
2. **Cobertura:** re-rodar coord Dr. Thomás → confirmar que **1** id_djen TJMG do processo 5004003-83.2023.8.13.0319 (o que tem OSMAR em `destinatarioadvogados`) aparece em `publicacoes_djen_servidor` com `coordenacao_id` da Thomás.
3. Diferenças remanescentes esperadas para Thomás: 2 Kurier + 3 TJMG sem OSMAR em metadados (todas legítimas).

---

## Notas

- Memory a atualizar: `mem://logic/djen/publication-date-and-timezone-normalization` (Servidor grava BRT 12:00 = 15:00 UTC) e `mem://features/monitoring/djen-servidor-pagination-parity` (suplemento por nome quando `uf=TODAS` mesmo com OAB).
- Não consultar `publicacoes_djen` em nenhum ponto (mantém isolamento Browser × Servidor).
