## Diagnóstico (rodei a Judit agora nos dois processos)

### Processo `0000755-53.2024.5.11.0001` — TRT11, 1ª instância, RO em trâmite
A Judit retornou agora:
- `data_julgamento: null` / `tem_data_julgamento: N`
- `relator: JULIO BANDEIRA DE MELO ARCE` (juiz do TRT11, **não é do TST**)
- `tipo_recurso_reclamante: null`, `tipo_recurso_banco: "RO"`

Conclusões:
1. **A "pauta TST 27/04/2026 / 5ª Turma / MORGANA RICHA" estava errada desde o início.** Esse processo nem sequer subiu ao TST: ainda está no TRT11 indo para julgamento de RO. O migration anterior (`20260428192638_fix_pauta_0000755.sql`) gravou um valor que não existe.
2. **O RO está atribuído ao banco, mas foi a reclamante quem recorreu.** Pelos andamentos: sentença → "JUNTADA A PETIÇÃO DE CONTRARRAZÕES" + "CONTRARRAZÕES AO RECURSO ORDINARIO" (feitas pelo banco) → "ADMISSIBILIDADE DO RECURSO - REMETER AO TRT". Ou seja, o banco contrarrazoou ⇒ o RO é da reclamante.

### Processo `0001376-72.2023.5.10.0014` — TRT10, RO em trâmite
A Judit retornou agora:
- `tipo_recurso_reclamante: "RO"`, `tipo_recurso_banco: "RO"` (duplicado)
- Andamentos: "CONTRARRAZÕES AO RECURSO ORDINÁRIO. RECLAMANTE" + "CRRO - AYMORE X JULIO CESAR EVANGELISTA SILVA" (contrarrazões feitas pelo reclamante) → o RO foi interposto pelo banco (Aymoré/Santander). Apenas um lado deveria ter.

## Causa raiz

Em `supabase/functions/buscar-judit/index.ts`:

1. **`extrairRecursosPorParte` (linhas 468-613) confunde contrarrazões com interposição.** Quando o step "JUNTADA A PETIÇÃO DE [recurso]" não existe explicitamente, o algoritmo lê o step de contrarrazões ("CONTRARRAZÕES AO RECURSO ORDINÁRIO. RECLAMANTE") e:
   - O regex `RX_NAO_RECURSO` filtra "CONTRARRAZÕES" no step de juntada, **mas** o step seguinte (sem a palavra contrarrazões) ainda casa em `RX_INTERPOSICAO` por conter "RECURSO ORDINÁRIO" — atribuindo o recurso pelo lado mencionado no texto, que é o lado que CONTRARRAZOOU, e portanto **inverte** o autor real.
   - Quando o texto menciona "RECLAMANTE" e o nome do banco aparece em outro step próximo, ambos os lados acabam marcados → duplicação RO/RO.

2. **Fallback de classificação (linhas 1427-1438) atribui sempre ao banco quando há polo passivo**, sem analisar quem realmente recorreu. Isso explica o `tipo_recurso_banco: "RO"` no processo `0000755...`.

3. **Migration anterior gravou pauta TST inexistente** para `0000755-53.2024.5.11.0001`. Precisa ser revertida.

4. **Tela continua exibindo dados antigos** porque, para o `0000755...`, mesmo após nova consulta a Judit retornará `data_julgamento: null`, e há risco do upsert do auto-save preservar valores antigos quando o novo é null.

## Plano de correção

### 1. Reverter pauta TST inventada do processo 0000755-53.2024.5.11.0001
Criar migration que zera os campos forçados pelo migration de 28/04:
```text
data_julgamento → NULL
tem_data_julgamento → 'N'
tipo_julgamento → NULL
turma → NULL (não é 5ª Turma)
relator → NULL (sobrescrito pela Judit)
horario_julgamento → NULL
```

### 2. Corrigir lógica de atribuição de recurso por parte (`extrairRecursosPorParte`)

Reescrever a heurística para refletir a realidade dos andamentos do PJe/TRT:

- **Considerar só steps explícitos de interposição**: "JUNTADA A PETIÇÃO DE RECURSO ORDINÁRIO/REVISTA/AGRAVO/EMBARGOS", "RECURSO ORDINÁRIO INTERPOSTO", "INTERPOSTO RECURSO". Ignorar qualquer step que mencione "CONTRARRAZÕES", "ADMISSIBILIDADE", "REMETIDOS", "PUBLICADO", "DISPONIBILIZADO".
- **Quando houver step de contrarrazões com identificação do lado que contrarrazoou** (ex.: "CONTRARRAZÕES AO RECURSO ORDINÁRIO. RECLAMANTE" / "CRRO - AYMORE x JULIO"), **inverter**: o autor do recurso é o lado oposto. Esse sinal é tão ou mais confiável que o "JUNTADA A PETIÇÃO DE …" para casos em que a interposição não aparece nos steps.
- **Não atribuir o mesmo recurso aos dois lados a menos que haja DOIS steps independentes de interposição** (um do reclamante e outro do banco). Quando só houver um sinal, atribuir a apenas um lado.
- **Fallback de classificação (linhas 1427-1438)**: usar a heurística de contrarrazões quando disponível; se não, deixar `null` em vez de chutar para o banco. É melhor vazio do que invertido.

### 3. Garantir que campos NULL sobrescrevam valores antigos no auto-save

Verificar `useDistribuicoesTst` / fluxo do botão Judit em `DistribuicaoTstForm.tsx` para garantir que, quando a Judit retorna `data_julgamento: null` e `tem_data_julgamento: 'N'`, esses valores sobrescrevam os antigos no `dados_benner` (não preservar valor antigo). Mesmo tratamento para `relator`/`turma`/`tipo_julgamento` quando vierem nulos da nova consulta.

### 4. Validar com nova consulta os dois processos

Após o deploy, esperar o resultado:

**0000755-53.2024.5.11.0001:**
```text
tipo_recurso_reclamante: RO
tipo_recurso_banco: (vazio)
data_julgamento: (vazio)
tem_data_julgamento: N
relator: JULIO BANDEIRA DE MELO ARCE
turma: (vazio - é 1ª instância, não há turma)
```

**0001376-72.2023.5.10.0014:**
```text
tipo_recurso_reclamante: (vazio)
tipo_recurso_banco: RO
relator: (vazio - 1ª instância TRT, sem julgador relator definido)
turma: (vazio)
```

## Arquivos afetados

- `supabase/functions/buscar-judit/index.ts` — reescrever `extrairRecursosPorParte` (linhas 468-613) e simplificar fallback (linhas 1427-1438).
- Nova migration `supabase/migrations/<timestamp>_revert_pauta_0000755.sql` — limpa pauta inventada.
- `src/components/distribuicao-tst/DistribuicaoTstForm.tsx` e/ou `src/hooks/useDistribuicoesTst.ts` — garantir que `null`/`'N'` da Judit sobrescrevem valores antigos.

## Observação importante para você

A informação de "data de julgamento 27/04/2026 / 5ª Turma / Morgana Richa" para o processo `0000755-53.2024.5.11.0001` **não existe na Judit hoje**. O processo está no TRT11, em fase de admissibilidade do RO, indo para o tribunal. Se você tem essa pauta de outra fonte (ex.: pauta interna, sistema do tribunal), me avise para eu não apagar ao reverter o migration — posso, em vez disso, marcar o campo como "manual" e impedir sobrescrita pela Judit.
