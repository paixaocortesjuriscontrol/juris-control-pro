# Judit criando recurso inexistente (dossiê 07.02.033.0003505785/23)

## A reclamação procede

Registro: dossiê `07.02.033.0003505785/23`, processo `0100386-97.2023.5.01.0060`, coordenação Dra. Lienne.

Histórico do próprio registro (auditoria + logs Judit):

- **07/08 13:30 — botão Judit:** gravou `Tipo de Recurso`, `Recurso do Banco` e **`Recurso do Reclamante` = "Recurso Ordinário Trabalhista"**, e Recorrente = "Ativo: EDIR DA SILVA, BANCO SANTANDER (BRASIL) S.A.". O log da Judit dessa consulta mostra que a instância lida era a do **TRT**, e o sistema usou a **classe da capa** como tipo de recurso.
- **11/08 10:33 — botão Judit de novo:** trocou `Recurso do Banco` para **"AÇÃO TRABALHISTA - RITO ORDINÁRIO"** — que não é recurso nenhum; é a classe do processo de 1º grau (a consulta caiu na instância de origem).
- **11/08 10:38 — correção manual** da advogada: Recorrente "Reclamada", `Recurso do Banco` = "Agravo de Instrumento", matérias preenchidas.

Ou seja: o recurso do reclamante e o "recurso" com nome de ação trabalhista foram **criados pela Judit a partir da classe da capa**, sem qualquer movimento de interposição — exatamente o que a regra do projeto proíbe (tipo de recurso só de interposição confirmada nos andamentos).

## Não é caso isolado

`260 registros` preenchidos pela Judit têm em algum dos campos de recurso uma classe que não é recurso (`AÇÃO TRABALHISTA - RITO ORDINÁRIO/SUMARÍSSIMO`, `ATORD`, `ATSUM`, `CUMPRIMENTO DE SENTENÇA`, `CUMPRSE`, `CUMSEN`, execuções), concentrados entre abril e agosto/2026 (173 em agosto).

O código atual já tem uma trava parcial (`classeRecursal` só é usada quando a instância lida é o TST), mas ela não impede os dois problemas restantes:

1. Quando a instância é o TST, a **classe da capa continua sendo atribuída a uma parte** como "recurso dela", só pelo `person_type` RECORRENTE — sem checar o andamento de interposição.
2. Os 260 registros já contaminados continuam no banco (e vão para a Carga Benner e para os relatórios).

## Correção proposta

1. **Tipo de recurso só com interposição confirmada.** Passar a exigir, também para a instância TST, um andamento Judit de interposição/recebimento do recurso com identificação do lado (`extrairRecursosPorParte`). Sem isso, os três campos (`Recurso do Reclamante`, `Recurso do Banco`, `Recurso de Terceiro`) voltam vazios com `fonte_tipo_recurso = 'nenhuma'` e o aviso amarelo já existente aparece no formulário.
2. **Lista negra de classes não recursais.** Bloquear na origem qualquer valor que seja ação/cumprimento/execução (`AÇÃO TRABALHISTA…`, `ATORD`, `ATSUM`, `CUMPRIMENTO…`, `CUMPRSE`, `CUMSEN`, execuções), inclusive em `Tipo de Recurso`.
3. **Limpeza dos dados já gravados.** Migração que zera apenas os campos de recurso com valor não recursal nesses 260 registros (nada mais é tocado), registrando a limpeza na auditoria para a coordenação conseguir revisar.
4. **Relatório de revisão.** Listar na tela Distribuição TST (filtro/pendência) os processos que ficaram sem tipo de recurso após a limpeza, para preenchimento manual ou por IA.

## Detalhes técnicos

- `supabase/functions/buscar-judit/index.ts` (~linhas 919-1204): condicionar `tipoRecursoReclamante/Banco/Terceiro` ao resultado de `extrairRecursosPorParte` (interposição confirmada), mantendo o override Santander apenas para decidir o lado, nunca para criar recurso; aplicar a lista negra em `expandirSiglaRecurso`/`classe` antes de expor `tipo_recurso`; ajustar `_judit_meta.fonte_tipo_recurso`.
- `src/lib/juditDistribuicaoTst.ts` (linhas 180-182, 325-327): mantém `applyJuditOnly` — vazio da Judit apaga valor antigo; sem mudança de contrato.
- Migração de limpeza em `dados_benner` restrita aos campos `tipo_recurso`, `tipo_recurso_reclamante`, `tipo_recurso_banco`, `tipo_recurso_terceiro` quando casarem a lista negra.
- `src/utils/distribuicaoTstPendencias.ts`: pendência "sem tipo de recurso" para os registros limpos.

## Verificação

- Reconsultar o dossiê `07.02.033.0003505785/23`: a Judit não deve mais escrever recurso do reclamante nem "AÇÃO TRABALHISTA - RITO ORDINÁRIO"; deve exibir o aviso de origem indefinida e preservar a correção manual da advogada.
- Após a migração, a consulta de classes não recursais nos campos de recurso deve retornar zero.
