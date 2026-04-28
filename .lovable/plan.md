## Objetivo

Preencher `tipo_recurso`, `tipo_recurso_reclamante` e `tipo_recurso_banco` **somente** quando a Judit confirmar a interposição. Sem fallback DataJud, sem inferência por classe da capa, sem duplicar para os dois polos. Quando a Judit não retornar, os campos ficam vazios e os dados antigos (incorretos) são apagados.

---

## 1. Edge Function `buscar-judit/index.ts`

### 1.1. Reescrever `extrairRecursosPorParte` com regras estritas por instância

```text
Para cada instância em allInstancesPageData (page_data da Judit):
  - instance=1 → ignorar (1º grau, sem recurso)
  - instance=2 ROT → tipos permitidos: RO, AP
  - instance=3 e classe∈{RR,AIRR,ARR,AgInt,ED-RR,ED-AIRR} → tipos permitidos: RR, AIRR
  - Para cada parte, varrer os steps DAQUELA instância procurando movimentos de
    INTERPOSIÇÃO (nunca contrarrazões, nunca admissibilidade):
    regex: /\bINTERP(O|Õ)E\b|\bINTERPOSI[ÇC][AÃ]O\b|\bRECURSO\s+ORDIN[AÁ]RIO\s+INTERPOSTO\b/i
    e identificar a parte autora da interposição via campo "party"/"polo" do step
  - Atribuir o tipo da classe da instância apenas ao polo que efetivamente recorreu
  - Se não conseguir identificar o polo, NÃO atribuir
```

Resultado: objeto `{ reclamante: string|null, banco: string|null, capa: string|null }` onde `capa` = tipo da maior instância encontrada (apenas para o campo `tipo_recurso` legado).

### 1.2. Remover fallback DataJud TST como fonte de tipo de recurso

- Manter `consultarDataJud` SOMENTE para `tribunal`, `relator`, `turma`, `classe da capa` e `dataDistribuicao`.
- **Remover** dos blocos das linhas ~956-970 e ~1001-1015 a atribuição de classes RR/AIRR ao processo quando vêm exclusivamente do DataJud.
- Quando `hint=TST` e Judit não trouxer TST: ainda preencher tribunal=TST e turma/relator do DataJud, mas `tipo_recurso_*` ficam `null`.

### 1.3. Resposta sempre explícita

Garantir que o JSON retornado contenha as 3 chaves mesmo quando vazias:
```json
{
  "tipo_recurso": null,
  "tipo_recurso_reclamante": null,
  "tipo_recurso_banco": null,
  "_judit_meta": {
    "instancias_encontradas": [1],
    "fonte_tipo_recurso": "judit" | "nenhuma",
    "motivo_vazio": "judit_sem_instancia_recursal" | null
  }
}
```

---

## 2. Frontend `DadosBennerForm.tsx` e `DadosBennerPartesTab.tsx`

### 2.1. Sobrescrever campos vazios (não preservar valor antigo)

Hoje a função `pick(judit, atual)` mantém o valor antigo quando Judit retorna `null`. Trocar por:

```ts
const pickJudit = (juditValue: string | null, _currentValue: string | null) => juditValue;
```

Aplicar especificamente aos 3 campos: `tipo_recurso`, `tipo_recurso_reclamante`, `tipo_recurso_banco`. Demais campos (relator, turma, etc.) continuam com `pick` normal.

### 2.2. Mostrar aviso quando Judit não trouxer recurso

Abaixo do bloco "Tipo Recurso" exibir alerta amarelo quando `_judit_meta.motivo_vazio === 'judit_sem_instancia_recursal'`:

```
⚠️ Judit retornou apenas 1ª instância — sem recurso interposto identificado.
   Os campos de Tipo de Recurso foram limpos. Preencha manualmente se necessário.
```

### 2.3. Badge "Judit" só aparece quando preenchido

Já é o comportamento atual via `fieldHighlight` — confirmar que campos vazios não recebem highlight verde.

---

## 3. UPDATE pontual nos 2 registros (insert tool)

```sql
-- 0001376-72.2023.5.10.0014: Judit confirma RO (instance=2) e AIRR (instance=3)
UPDATE dados_benner
SET tipo_recurso_reclamante = 'RO',
    tipo_recurso_banco      = 'AIRR',
    tipo_recurso            = 'AIRR',
    tribunal                = 'TST'
WHERE processo = '0001376-72.2023.5.10.0014';

-- 0000755-53.2024.5.11.0001: Judit só vê instance=1, então limpar tudo
UPDATE dados_benner
SET tipo_recurso_reclamante = NULL,
    tipo_recurso_banco      = NULL,
    tipo_recurso            = NULL,
    tribunal                = 'TRT11'
WHERE processo = '0000755-53.2024.5.11.0001';
```

---

## 4. Memória do projeto

Adicionar nova memória `mem://logic/judit/resource-attribution-rules`:

> Tipo de recurso só é preenchido quando confirmado pela Judit no `page_data`.
> Regras: instance=2→RO/AP; instance=3→RR/AIRR. Atribuir somente ao polo que
> aparece como interpositor em movimentos da instância. Sem fallback DataJud
> para tipo de recurso. Judit retornando vazio limpa valores antigos.

Atualizar `mem://index.md` Core: "Tipo de recurso vem só da Judit; sem fallback DataJud; vazio sobrescreve dados antigos."

---

## 5. Validação

1. Disparar busca Judit no `0001376-72.2023.5.10.0014` → deve gravar Reclamante=RO, Banco=AIRR, capa=AIRR, Tribunal=TST.
2. Disparar busca Judit no `0000755-53.2024.5.11.0001` → deve limpar os 3 campos e mostrar aviso amarelo.
3. Verificar logs da edge function (`[buscar-judit] tipo_recurso fonte=...`) para confirmar que DataJud não está mais sendo usado para tipo.

---

## Arquivos afetados

- `supabase/functions/buscar-judit/index.ts` — reescrita parcial
- `src/components/benner/DadosBennerForm.tsx` — `pickJudit` para campos de recurso + alerta amarelo
- `src/components/benner/DadosBennerPartesTab.tsx` — mesmo tratamento se aplicável
- Migração SQL: 1 UPDATE em 2 linhas (via insert tool, não migration)
- `mem://logic/judit/resource-attribution-rules.md` (nova) e `mem://index.md` (Core)

## Não inclui

- Não vamos criar segunda requisição forçada Judit (você quer só o que a Judit retornar de primeira)
- Não vamos manter inferência por classe DataJud
- Não vamos criar nova coluna no banco