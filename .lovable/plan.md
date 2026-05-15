## Diagnóstico

Os monitoramentos das coordenações **Santander Cível** e **Santander Trabalhista** são todos do tipo `advogado` (Carlos José Elias Junior – OAB 10424 e Osmar Mendes Paixão Cortes – OAB 15553) e estão configurados com **listas de UFs separadas por vírgula** no campo `uf`, por exemplo:

```
DF,MT,RO,AC,MS,RR,AP,PA,AM,TO,GO,RS
DF,AC,ES,GO,PE,PB,RR,RS,SC,SP,SE,TO,RO,PA,AL,AM,PI,MA,PR,MG,AP,RJ,BA,MS,RN,MT,CE
```

No engine da Paralela (`useDjenTermosParalelaEngine.ts`, linhas 941-944) esse `uf` é repassado direto para `pjeComunicaClient.buscarPjeComunicaPaginado`, e em `src/utils/pjeComunicaClient.ts` (linhas 317-350) a regra é:

```ts
const ufValida = uf && uf !== "TODAS" && uf !== "UNDEFINED";
if (ufValida && oab) {
  qp.set("numeroOab", oab);
  qp.set("ufOab", uf);   // ← envia "DF,MT,RO,..." para a API
  ...
}
```

A API do PJE Comunica aceita **uma única UF** em `ufOab`. Ao receber a string com vírgulas ela ignora o filtro / devolve listagem vazia, e por isso a Paralela retorna 0 publicações para esses advogados (a edge function `buscar-djen` já trata o caso, mas o cliente do browser não).

Os logs confirmam: as últimas execuções `djen_paralela` em 14-15/05 retornaram `registros_encontrados: 0` várias vezes, mesmo com a engine rodando normalmente.

## Correção

Em `src/utils/pjeComunicaClient.ts`, no bloco `if (params.tipo === "advogado")`, tratar o caso "lista de UFs":

1. Normalizar `uf`, detectar se contém `,`.
2. Se for **uma única UF válida** → manter o comportamento atual (`numeroOab` + `ufOab` + `nomeAdvogado`).
3. Se for **lista com vírgulas** ou `"TODAS"` → cair no ramo cross-UF: enviar **apenas `nomeAdvogado`** (normalizado, sem acentos), exatamente como já é feito hoje para `TODAS`. A Paralela já roda por `siglaTribunal`, então o escopo continua respeitado, e os pós-filtros de tribunal/UF do engine (validador + `tribunaisMon`) garantem a precisão.
4. Aplicar o mesmo tratamento no fallback de retry da mesma função (linhas 514-558), onde `ufValida` também usa a comparação simples.

Sem mudanças no schema, na edge function `buscar-djen` (que já trata vírgulas) nem na configuração dos monitoramentos.

## Validação

- Rodar a Paralela manualmente para o dia atual nas duas coordenações Santander e confirmar que aparecem novas publicações para Carlos José Elias Jr e Osmar Mendes Paixão Cortes.
- Verificar no console do browser as linhas `[PJE Comunica] UF=... → buscando APENAS por nomeAdvogado: ...` para os monitoramentos com lista de UFs.
- Conferir `execucoes_agendadas` (`tipo='djen_paralela'`): `registros_encontrados` deve voltar a ser > 0.
