# Matérias "---" na Distribuição TST — planilha e limpeza

## Situação confirmada

Consulta em `dados_benner`: **548 processos** (todos na Coordenação Dra. Renata Santander) têm o campo de matérias preenchido apenas com traços (`---`, `----`, `-----`):

- 409 em Matérias Recurso Reclamante
- 220 em Matérias Recurso Banco (81 processos têm nos dois)
- 541 em `rascunho` e 7 já em `pronto_envio`

Esses traços não existem na lista de matérias: são resíduo de uma alteração no catálogo que removeu itens, e a tela passou a exibir o valor "órfão" como se fosse uma matéria selecionada — gerando linha na Análise por Matéria com pendências impossíveis de resolver.

## O que será feito

### 1. Planilha com os 548 processos

Gerar um arquivo Excel entregue no chat com as colunas:

Processo | Dossiê | Equipe | Situação (rascunho/pronto envio) | Data de distribuição | Onde está o "---" (Reclamante / Banco / ambos)

Ordenado por data de distribuição (mais recentes primeiro), com aba separada destacando os 7 processos já em `pronto_envio`.

### 2. Retirar a seleção "---" do banco

Atualização de dados que, em `materias_recurso_reclamante` e `materias_recurso_banco`:

- remove o item quando ele é composto só de traços/espaços, seja ele o único item ou um entre vários;
- se não sobrar nenhuma matéria, o campo fica vazio (null) e a tela volta a mostrar "nenhuma matéria selecionada", sem linha de análise;
- remove também a linha correspondente dentro dos JSONB `materias_analise_reclamante` e `materias_analise_banco`, para não sobrar análise órfã.

Nenhuma outra informação do processo é alterada. Nada de mudança de tela ou de regra: só a limpeza do valor inválido.


## Detalhes técnicos

- Critério de detecção: `~ '^[\s-]*-{2,}[\s-]*$'` por item, após split por `;` / `,` conforme `parseMateriasString`.
- A limpeza roda como migração única (UPDATE em `dados_benner`), sem alterar demais campos.
- Filtro de sanitização aplicado em `parseMateriasString` / `reconcileMateriasAnalise`, mantendo o comportamento atual de "Outra Matéria".
- Antes/depois: contagem registrada para conferência (548 esperados).
