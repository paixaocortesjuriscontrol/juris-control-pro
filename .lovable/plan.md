# Processo 0020740-78.2024.5.04.0461 — origem do preenchimento da seção Julgamento

## O que já foi apurado (consultas ao banco, sem alterar nada)

Registro em `dados_benner` (id `9c96e98d…`), dossiê `07.02.033.0004118458/24`:

- Data Julgamento? (K) = **N**
- Data Julgamento (L) = **2025-07-03**
- Horário (M) = **12:39**
- Tipo Julgamento (N) = **Presencial**
- Entrega Memoriais / Sustentação Oral = vazios

**Não foi a Judit.** Todos os 6 registros em `judit_logs` desse processo
(14/05, 21/05 e 26/06/2026) retornaram `data_julgamento = null`,
`horario_julgamento = null`, `tipo_julgamento = null` e
`tem_data_julgamento = "N"`. Isso é coerente com o código atual da função
`buscar-judit`, que declara explicitamente que campos de pauta/julgamento
não são mais extraídos por heurística e devolve sempre nulos com
`tem_data_julgamento = "N"`.

**Quem preencheu foi a IA de anexos.** O log gravado no próprio registro
(campo Observação do Advogado) traz:

```text
[IA 21/05/2026, 13:15:06]
IA preencheu 11 campo(s) em Distribuição TST e 12 em Dados Benner.
Benner: materia_honra, provas_digitais, tem_data_julgamento,
data_julgamento, horario_julgamento, tipo_julgamento, processo_baixado, ...
```

A função `preencher-form-ia-anexos` é instruída a pegar "a data MAIS
RECENTE entre certidão de pauta / sessão / decisão" nos anexos. Nesse
processo ela devolveu 03/07/2025 às 12:39 "Presencial" — que tem toda a
cara de data/hora de um ato processual do TRT-4 (o processo só foi
distribuído no TST em 23/03/2026), não de sessão de julgamento no TST.
Como a Judit rodou depois (16:42 do mesmo dia) e devolve nulos, e a regra
de patch da Judit só sobrescreve quando há valor, os valores da IA
permaneceram — inclusive com a incoerência K = "N" com L/M/N preenchidos.

Também é relevante para a advogada: `turma = PRESIDÊNCIA`,
`relator = LUIZ PHILIPPE VIEIRA DE MELLO FILHO` (Vice-Presidência/AIRR),
`erro_judit = true` e status já `pronto_envio`.

## O que faço em seguida (com aprovação)

1. **Nova consulta à API Judit** para `0020740-78.2024.5.04.0461`, com
   `force_refresh: true` e `com_anexos: false`, via chamada direta à
   Edge Function `buscar-judit`. Comparo o retorno atual (capa, steps,
   órgão julgador, classe, relator/turma, indícios de inclusão em pauta)
   com o que está gravado e entrego um resumo pronto para encaminhar à
   advogada, informando se existe ou não sessão de julgamento designada.
2. Apresento a conclusão em texto (sem alterar o registro).

## Correções opcionais (só se você pedir)

- Limpar L/M/N desse registro (deixando K = "N"), já que não há sessão.
- Regra de consistência no formulário e/ou no patch da IA: quando
  `tem_data_julgamento` = "N", não gravar data/horário/tipo de julgamento
  (evita repetir o caso em outros processos preenchidos pela IA de anexos).

Nada é alterado no banco nem no código nesta etapa além da consulta à Judit.
