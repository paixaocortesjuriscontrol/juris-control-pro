# Corrigir o prompt da IA de anexos (seção Julgamento)

## Diagnóstico confirmado

No prompt atual (`preencher-form-ia-anexos/index.ts`, linhas 102-108) o bloco de julgamento diz apenas:

- `tem_data_julgamento`: "S" se há sessão marcada/realizada
- `data_julgamento`: "pegar a data MAIS RECENTE entre certidão de pauta, intimação de julgamento e acórdão"

Não existe nenhuma restrição de **instância** nem de **tribunal**. Por isso a IA aceitou um andamento do TRT-4 (03/07/2025 12:39) como data de julgamento no TST.

Além disso, `validar.ts` (linhas 247-256) força `tem_data_julgamento = "S"` quando existe data — ou seja, a validação só corrige a coerência num sentido; nunca limpa a data quando a IA (ou a Judit) indica que não há sessão.

## Prompt melhorado (bloco Julgamento)

Substituir os itens de julgamento por regras explícitas:

```text
▸ SEÇÃO JULGAMENTO (K/L/M/N) — REGRAS ESTRITAS
  ESCOPO: SOMENTE sessão de julgamento no TST (Turma, SDI, SBDI-1/2, SDC, Órgão Especial,
  Tribunal Pleno). É PROIBIDO usar qualquer sessão, pauta, audiência, acórdão ou andamento
  de 1ª instância (Vara do Trabalho) ou de TRT (2ª instância) — inclusive o acórdão
  recorrido, que é o objeto do recurso e NUNCA é a data de julgamento no TST.

  - tem_data_julgamento: "S" somente se houver PUBLICAÇÃO DE PAUTA, CERTIDÃO DE PAUTA,
    INTIMAÇÃO DE SESSÃO ou ACÓRDÃO DO TST citável. "N" em qualquer outro caso
    (processo em gabinete, conclusos ao relator, aguardando pauta, sem pauta designada).
  - data_julgamento / horario_julgamento / tipo_julgamento: preencher SOMENTE quando
    tem_data_julgamento = "S". Se K = "N", OMITA L, M e N do retorno — nunca devolva
    data com K = "N".
  - A evidência de data_julgamento deve conter, no trecho literal, indício de que é sessão
    do TST (ex.: "Turma do TST", "sessão de julgamento", "pauta de julgamento", nº do órgão
    julgador do TST). Sem esse indício, OMITA os quatro campos.
  - Andamento processual genérico com data/hora (ex.: "03/07/2025 12:39 - Juntada de
    petição", "distribuído", "expedida intimação") NÃO é data de julgamento.
  - Se a Judit informar tem_data_julgamento = "N" ou não informar órgão/pauta no TST,
    a Judit prevalece: OMITA L/M/N e registre em "_alertas"
    "documento sugere julgamento mas Judit não indica pauta no TST".
  - Datas anteriores à data_distribuicao no TST não podem ser data_julgamento.
```

## Trava técnica (complemento ao prompt)

Prompt sozinho não garante o resultado. Adicionar em `validar.ts`:

1. Se `tem_data_julgamento === "N"` → limpar `data_julgamento`, `horario_julgamento`, `tipo_julgamento` e registrar alerta.
2. Se há `data_julgamento` mas nenhuma evidência que cite TST/pauta/sessão → rebaixar confiança e limpar L/M/N (em vez de promover K para "S").
3. Se `data_julgamento < data_distribuicao` (Judit) → descartar.
4. Manter a promoção K="S" apenas quando a data passou pelas validações acima.

## Aplicar aos dois motores

O mesmo bloco e as mesmas travas valem para `preencher-form-ia-anexos-processo` e `analisar-tst-prompt-ia`, que compartilham a lógica de julgamento.

## Limpeza do registro atual

Limpar L/M/N do processo 0020740-78.2024.5.04.0461 e varrer a base por registros com `tem_data_julgamento = 'N'` e data preenchida, listando-os antes de qualquer limpeza em massa.
