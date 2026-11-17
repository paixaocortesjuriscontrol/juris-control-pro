# Pautas de Julgamento: correções pedidas pela Dra. Lienne

## O que procede (conferido)
1. **Advogado interno com nome do escritório.** O preenchimento automático usa os responsáveis do escritório cadastrados na ficha da Distribuição TST, como a Dra. Lienne Vasconcelos. Hoje 324 das 2.278 pautas preenchidas estão com nome de alguém do escritório. O correto é o advogado interno do banco, e esse dado não existe nas fichas.
2. **Ministro escrito de vários jeitos.** O mesmo relator aparece de 5 formas, por exemplo "Ministro Ives Gandra da Silva Martins Filho", "MINISTRO ... FILHO." e "Ives Gandra Martins Filho". A planilha já padroniza, mas a tela e os dados gravados não.
3. **Coluna a mais na planilha.** Criei "COMENTÁRIOS ADVOGADO INTERNO RESPONSÁVEL DO BANCO", que não existe no modelo. O modelo tem só a coluna AC, "COMENTARIOS ADVOGADO INTERNO RESPONSAVEL".
4. **Cores do cabeçalho.** Hoje saem sem as cores do modelo.
5. **Dados faltantes só da semana.** O botão usa só a semana aberta.
6. **Devolver a resposta da Dra. Iara.** O "Importar planilha" atual é a importação completa de pautas, não serve para isso.
7. **Parte recorrente.** 542 pautas estão sem parte recorrente.

## O que será feito
1. **Advogado interno:** parar de preencher com pessoas do escritório. Limpar as 324 pautas que estão com nome do escritório. Elas ficam "A PREENCHER" e entram no relatório de dados faltantes. Na tela, o campo mostra só o advogado interno do banco.
2. **Ministro:** gravar sempre no padrão "NOME DO MINISTRO" em maiúsculas, sem "Ministro" e sem ponto no fim, na tela, no complemento automático e nas pautas já gravadas.
3. **Planilha igual ao modelo:** remover a coluna extra. A coluna AC fica com os comentários do advogado interno e mostra "A PREENCHER" quando vazia.
4. **Cores do modelo no cabeçalho:**
   - A até V: cinza
   - W até Z: laranja-claro
   - AA até AC: vermelho
   - AD e AE: cinza-rosado
5. **Dados faltantes por período:** o botão passa a pedir as datas "de" e "até". O padrão é todo o período disponível.
6. **Novo botão "Importar dados faltantes":** recebe a planilha que a Dra. Iara devolver, no mesmo formato gerado. Localiza cada pauta pelo número do processo e preenche dossiê, equipe e advogado interno. Só preenche o que estiver vazio, sem apagar o que já existe. No fim, mostra um relatório do que foi preenchido e do que não foi encontrado.
7. **Parte recorrente:** buscar na publicação do DJEN que gerou a pauta. Só quando não encontrar, fica "A PREENCHER". Antes, vou conferir em algumas publicações reais como a parte recorrente aparece, para não errar o nome.

## Detalhes técnicos
- Migração: tirar o uso de `dados_benner_responsaveis` em `pauta_preencher_de_benner`, `gerar_pautas_tst_auto` e `pauta_advogado_interno`. Aplicar `relator` com upper, sem prefixo e sem ponto final, nas funções de preenchimento.
- Dados (UPDATE): limpar `advogado_interno` quando coincidir com `profiles.nome`. Padronizar `pautas_tst.relator`.
- `pautasSemanaExport.ts`: remover `comentarios_advogado_banco` de `COLUNAS_PAUTA`, incluir `comentarios_advogado` em "A PREENCHER" e aplicar as cores por coluna no cabeçalho, preservando o estilo de `baixarXlsxTst`.
- `PautasTst.tsx`: período no relatório de faltantes, com consulta paginada por `data_julgamento`, e novo diálogo de importação dos faltantes.
- `PautasTstForm.tsx`: remover a área "Comentários do advogado interno responsável do banco". O campo continua no banco, sem uso.
- Parte recorrente: extrair de `publicacoes_djen.partes_json`/conteúdo (termo "RECORRENTE") depois de validar em amostras.
