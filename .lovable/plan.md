# Audiência "reagendada" da Dra. Janaina (processo da Instrução 09/02 -> 16/02)

## O que o sistema mostra (conferido)

Nenhuma audiência foi apagada. As duas existem e estão pendentes:

- 10:50 (Brasília) — ela criou, a partir da publicação, a audiência **Instrução Presencial em 16/02/2027 às 10:30**.
- 10:51 — abriu a audiência antiga de 09/02/2027, marcou "Reagendado" e informou a nova data 16/02. O sistema **mudou a data da antiga para 16/02** (é isso que o "Reagendado" faz hoje: move o próprio registro).
- 10:51:58 — ela salvou de novo a antiga.

Resultado: ficaram **duas audiências idênticas** em 16/02/2027 às 10:30 (a antiga movida e a nova da publicação). Na tela elas aparecem uma em cima da outra, com o mesmo título, então parece que a nova sumiu. A de 09/02 deixou de existir nessa data porque foi movida.

A reclamação procede em parte: nada foi apagado, mas o sistema deixou criar uma duplicata sem avisar.

## O que será feito

1. **Arrumar este caso**
   - A antiga volta para **09/02/2027**, com situação **Reagendado** (riscada, como histórico).
   - A nova, criada da publicação, fica sozinha em 16/02/2027, pendente, ligada à publicação.
   - Ligação entre as duas: a nova passa a mostrar "Originada da audiência de 09/02/2027".

2. **Evitar que se repita**
   - Ao marcar "Reagendado" com nova data, o sistema verifica se já existe audiência do mesmo processo nessa data.
   - Se existir, aparece um aviso: "Já existe audiência em 16/02 para este processo. Deseja apenas marcar esta como reagendada e ligá-la à existente?" — e a antiga fica na data original, sem criar duplicata.
   - Sem audiência na nova data, continua como hoje.

3. **Conferir outros casos iguais**
   - Levantar audiências do mesmo processo, mesma data e hora, que surgiram por reagendamento, e entregar uma lista para decisão (sem alterar nada automaticamente).

## Detalhes técnicos

- Dados: `audiencias_detectadas` id `84004799-…` volta para `data_audiencia = 2027-02-09 13:30 UTC`, `hora = 10:30`, `status = 'reagendado'`; `8de82b2c-…` recebe `originada_de = 84004799-…`; registrar linha em `historico_reagendamentos_audiencia`.
- `AudienciaFormSimplificado.tsx` (fluxo `reagendando`): antes de salvar, consultar `audiencias_detectadas` por `processo_id` + data nova (excluindo o próprio id). Se houver, diálogo de confirmação; ao confirmar, manter `data_audiencia` original, gravar `status = 'reagendado'` e setar `originada_de` na existente.
- Relatório de duplicatas: consulta por `processo_id, data_audiencia, hora` com contagem > 1 e status não cancelado, exportada em Excel.
