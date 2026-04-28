## Diagnóstico

Processo `0100798-32.2021.5.01.0049` (dossiê `07.02.033.0003178059/21`):

A função `buscar-judit` (já corrigida) retorna ao vivo:
- `tipo_recurso_reclamante: "RO"`
- `tipo_recurso_banco: null`  ← Judit não confirma interposição pelo banco
- `_judit_meta.fonte_tipo_recurso: "judit"`

Mas no banco está gravado:
- `tipo_recurso_reclamante: "RO + ED + RR + AIRR"`
- `tipo_recurso_banco: "RO"`  ← errado, vindo da importação/legado

A advogada está certa: o `RO` do Banco não procede. A Judit (única fonte autorizada de `tipo_recurso*`) confirma só o `RO` do reclamante.

## Causa-raiz

`src/components/distribuicao-tst/DistribuicaoTstForm.tsx` (linhas 164-218) usa um helper `apply()` que **só escreve quando a Judit retorna valor** — se vier `null`, mantém o valor anterior. Isso contraria a regra registrada em `mem://logic/judit/resource-attribution-rules.md` (que `DadosBennerForm.tsx` já segue corretamente via `pickJuditOnly`):

> "Frontend usa `pickJuditOnly` (não `pick`) para os 3 campos: vazio da Judit APAGA valor antigo."

Por isso, mesmo a função backend retornando corretamente `tipo_recurso_banco: null`, o formulário da tela `/distribuicao-tst` preserva o `RO` antigo (vindo da planilha importada).

## Mudança

Em `src/components/distribuicao-tst/DistribuicaoTstForm.tsx`, dentro do bloco que aplica o resultado da Judit (~linhas 166-218):

1. Adicionar helper específico para os 3 campos de tipo de recurso:
   ```ts
   const applyJuditOnly = (field: string, novo: any) => {
     // Vazio da Judit APAGA valor antigo (regra mem://logic/judit/resource-attribution-rules)
     next[field] = hasValue(novo) ? novo : null;
     if (hasValue(novo)) filled.add(field);
     else filled.delete(field);
   };
   ```

2. Trocar `apply` por `applyJuditOnly` apenas para:
   - `tipo_recurso`
   - `tipo_recurso_reclamante`
   - `tipo_recurso_banco`

3. Demais campos continuam com `apply` (Judit como fonte de verdade quando preenche, mantém manual quando vazio).

## Verificação após o fix

- Re-buscar Judit no processo `0100798-32.2021.5.01.0049` na tela `/distribuicao-tst`.
- Esperado: campo "Tipo de Recurso do Banco" fica vazio (com aviso amarelo já existente quando `_judit_meta.fonte_tipo_recurso='nenhuma'`; aqui a fonte é `'judit'` mas sem recurso pelo banco — fica vazio mesmo).
- "Tipo de Recurso do Reclamante" mostra `RO`.

## Memória

Atualizar `mem://logic/judit/resource-attribution-rules.md` para reforçar que a regra `pickJuditOnly` vale também para `DistribuicaoTstForm`, não só `DadosBennerForm`.

## Arquivos afetados

- `src/components/distribuicao-tst/DistribuicaoTstForm.tsx` (helper + 3 trocas de `apply` → `applyJuditOnly`)
- `mem://logic/judit/resource-attribution-rules.md` (escopo)
