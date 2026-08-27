# Matérias "---" na Distribuição TST — planilha e limpeza

## Situação confirmada

Consulta em `dados_benner`: **548 processos** (todos na Coordenação Dra. Renata Santander) têm o campo de matérias preenchido apenas com traços (`---`, `----`, `-----`):

- 409 em Matérias Recurso Reclamante
- 220 em Matérias Recurso Banco (81 processos têm nos dois)
- 541 em `rascunho` e 7 já em `pronto_envio`

Esses valores viraram uma "matéria" fictícia: aparecem como chip selecionado e geram uma linha na Análise por Matéria cobrando Aparelhamento, Chance Turma, Chance Relator e Êxito — pendência impossível de resolver.

## O que será feito

### 1. Planilha com os 548 processos

Gerar um arquivo Excel entregue no chat com as colunas:

Processo | Dossiê | Equipe | Situação (rascunho/pronto envio) | Data de distribuição | Onde está o "---" (Reclamante / Banco / ambos)

Ordenado por data de distribuição (mais recentes primeiro), com aba separada destacando os 7 processos já em `pronto_envio`.

### 2. Remover a matéria "---" da seleção

Migração de dados que, nos campos `materias_recurso_reclamante` e `materias_recurso_banco`:

- remove o item quando ele é composto só de traços/espaços, seja ele o único item ou um entre vários;
- se após a remoção não sobrar nenhuma matéria, o campo fica vazio (null), e o processo passa a ser cobrado normalmente como pendência real de preenchimento;
- remove também a linha correspondente dentro dos JSONB `materias_analise_reclamante` e `materias_analise_banco`, para não sobrar análise órfã.

### 3. Evitar que volte

Passar a tratar valores só com traços como "sem matéria" na leitura/gravação do formulário, para que importações futuras que tragam `---` não recriem o chip.

## Detalhes técnicos

- Critério de detecção: `~ '^[\s-]*-{2,}[\s-]*$'` por item, após split por `;` / `,` conforme `parseMateriasString`.
- A limpeza roda como migração única (UPDATE em `dados_benner`), sem alterar demais campos.
- Filtro de sanitização aplicado em `parseMateriasString` / `reconcileMateriasAnalise`, mantendo o comportamento atual de "Outra Matéria".
- Antes/depois: contagem registrada para conferência (548 esperados).
