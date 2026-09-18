# Prazo fatal errado ao criar prazo pela leitura do DJEN

## A reclamação procede

Confirmei no código. Ao criar um prazo (ou tarefa) a partir de uma publicação do DJEN:

- A **data limite** é calculada a partir da **data da publicação** (ex.: 16/09) — por isso está certa.
- O **prazo fatal** do modelo de título é calculado a partir de **hoje**, ignorando a data da publicação — por isso sai errado.

Exemplo da Jéssica (impugnação ao laudo, 5 dias, lendo a publicação de 16/09/2026, hoje 18/09/2026):
a data limite conta de 16/09; o fatal conta de 18/09, dois dias adiante.

## O que será corrigido

1. O prazo fatal passa a ser contado a partir da mesma data base da data limite
   (data da publicação; sem publicação, a data base do formulário; em último caso, hoje).
2. Vale nos dois formulários: criação de prazo e criação de tarefa a partir da publicação.
3. A contagem em dias úteis do fatal passa a usar a mesma regra já usada na data limite,
   incluindo a suspensão de 20/12 a 20/01 (CLT art. 775-A).
4. Se o modelo trouxer uma data fatal fixa (não relativa), ela continua sendo aplicada como está.
5. Alteração feita quando o modelo é escolhido; datas já digitadas à mão pela usuária não são sobrescritas.

Nada é alterado na base de dados: prazos já criados com fatal errado continuam como estão.
Se a senhora quiser, depois posso levantar os prazos criados nos últimos dias para revisão manual.

## Detalhes técnicos

- Causa raiz: em `src/lib/aplicarPadroesModelo.ts`, `resolverPadroes()` resolve qualquer campo
  `kind: "date"` (inclusive `data_fatal`) via `resolverData()`, que usa sempre `new Date()` como base.
- Correção: aceitar uma data base opcional em `resolverData`/`resolverPadroes`
  (`resolverPadroes(modelo, dataBase)`), propagando a base para os modos `d`, `du`, `hoje`,
  `amanha`, `prox_seg`; `addDiasUteis`/`emSuspensaoClt` já existentes são reaproveitados.
- `src/components/prazos/PrazoDialog.tsx`: passar o `dataBase` (memo das linhas 380-387) ao
  `resolverPadroes` no `onSelect` do `ModeloTituloPicker` (linha ~936), mantendo o restante do fluxo
  de `data_fatal` (linhas 966-970).
- `src/components/delegacao/NovaTarefaDialog.tsx`: mesma mudança no `onSelect` (linha ~1033),
  usando `data_base` do formulário ou `publicacao.data_publicacao ?? data_disponibilizacao`.
- Demais telas que chamam `resolverPadroes` (evento, audiência, parcelas) seguem com a base
  padrão (hoje), sem mudança de comportamento.
