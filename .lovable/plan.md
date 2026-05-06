# Preencher tipo_recurso_reclamante / banco via Judit no form Distribuição TST

## Problema
No `DistribuicaoTstForm.tsx`, ao clicar em **Judit**, apenas `tipo_recurso` (classe da capa) é preenchido. Os campos **Tipo de Recurso – Reclamante** e **Tipo de Recurso – Banco** ficam manuais, mesmo o backend `buscar-judit` já retornando `tipo_recurso_reclamante` e `tipo_recurso_banco` calculados (cruzamento RECORRENTE no TST × RECLAMANTE/RECLAMADO na origem).

Resultado: usuário precisa preencher manualmente e os campos não recebem o destaque verde da Judit.

## Solução
Ligar os dois campos ao retorno da Judit, exatamente como já é feito em `tipo_recurso`, e deixar o destaque verde funcionar (a infra `juditClass` + `JuditBadge` já está nos campos — só falta marcar como preenchidos).

### Mudanças
**Arquivo:** `src/components/distribuicao-tst/DistribuicaoTstForm.tsx`

Dentro do bloco do `runJudit` (linhas ~225–272), adicionar logo após `apply("tipo_recurso", data.tipo_recurso);`:

```ts
apply("tipo_recurso_reclamante", data.tipo_recurso_reclamante);
apply("tipo_recurso_banco", data.tipo_recurso_banco);
```

Como o helper `apply` já:
- só sobrescreve quando a Judit traz valor (`hasValue`),
- adiciona o nome do campo ao `filled` set (que alimenta `juditSessionFields`),

o destaque verde (via `juditClass(form.tipo_recurso_reclamante/banco)` + `<JuditBadge show={isJuditFilled(...)} />` já presentes nas linhas 507–561) passa a aparecer automaticamente, igual aos outros campos preenchidos pela Judit.

### Comportamento resultante
- Clique em **Judit** → backend retorna `tipo_recurso_reclamante` / `tipo_recurso_banco` já calculados → form preenche os dois campos.
- Ambos ficam com fundo verde (mesmo padrão do form Dados Benner) e badge "Judit".
- Auto-save persiste os valores em `distribuicoes_tst` (colunas já existem).
- Se a Judit não retornar (`null`), o valor manual atual é preservado (regra do `apply` com `hasValue`).

### Não muda
- Backend `buscar-judit` (já calcula corretamente).
- Form Dados Benner (já consome via `applyJuditOnly`).
- Política de sobrescrita / regra "Judit é fonte da verdade" do form Distribuição TST.
