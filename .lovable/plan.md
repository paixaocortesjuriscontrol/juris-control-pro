# Plano: Botão de download da planilha modelo — Base PCA - TST - Distribuições

## Objetivo
Na tela **Admin › TST › Base PCA - TST - Distribuições** (`src/pages/AdminTstBasePcaDistribuicoes.tsx`), adicionar um botão **"Baixar planilha modelo"** ao lado do botão de upload. Ao clicar, o navegador baixa um `.xlsx` com os cabeçalhos exatos que o parser da tela espera, para o usuário preencher e enviar.

## O que vai ser feito

1. **Adicionar função `baixarPlanilhaModelo()`** no componente, usando `XLSX` (já importado no arquivo):
   - Cria uma planilha com **uma linha de cabeçalho** contendo todas as colunas reconhecidas por `findHeaderRow` + `mapearCamposPlanilha`.
   - Colunas obrigatórias primeiro: `Dossiê`, `Processo`.
   - Demais colunas na ordem lógica do parser:
     `Centralizador`, `Comarca`, `Juízo`, `UF`, `Objeto Padrão`, `Assunto`, `Categoria`, `Subcategoria`, `Equipe`, `Tribunal`, `Tipo de Recurso`, `Data da Distribuição no TST STF`, `Recorrente`, `Turma`, `Relator`, `Recorrente Pos Turma Objeto Recurso Favorável`, `Recorrente Pos Turma Objeto Recurso Desfavorável`, `Posicionamento Relator Objeto Recurso Favorável`, `Posicionamento Relator Objeto Recurso Desfavorável`, `Recorrente Recurso Bem Aparelhado`, `Recorrente Recurso Mal Aparelhado`, `Recorrente com Chance de Êxito`, `Recorrente sem Chance de Êxito`, `Resumo Ganhamos`, `Resumo Perdemos`, `Análise do Quarteirizado`, `Retorno Esclarecimentos dos Quarteirizado`, `Há Risco de Mídia Negativa`, `Há Discussão sobre Provas Digitais`, `Temos Data de Julgamento`, `Datajulgamento`, `Horajulgamento`, `Julgamento`, `Matéria de Honra`, `Entrega de Memoriais`, `Sustentação Oral`, `Resultado sem Transcendência`, `Resultado Recurso não Conhecido`, `Resultado Recurso Conhecido e Provido`, `Resultado Recurso Conhecido e não Provido`, `Resultado Outra`, `Processo Baixado do TST`.
   - **Uma linha de exemplo** preenchida com valores fictícios válidos (ex.: Dossiê `0001`, Processo `0000000-00.0000.5.00.0000`, Tribunal `TST`, chance de êxito `Sim`) para orientar o preenchimento.
   - Largura de colunas ajustada (aprox. 20) para legibilidade.
   - Salva como `modelo_base_pca_distribuicoes.xlsx`.

2. **Adicionar o botão** na seção "1. Upload da planilha", ao lado do botão "Escolher planilha (.xlsx)":
   - Ícone `Download` (já importado), `variant="outline"`, `size` padrão.
   - Não depende de `busy` (pode ser clicado a qualquer momento).

## Não será alterado
- Nenhuma lógica de parser, busca, TAG ou cadastro.
- Sem mudanças no banco de dados.
- Sem novas dependências.

## Detalhe técnico
A geração usa apenas `XLSX.utils.aoa_to_sheet` + `XLSX.utils.book_new` + `XLSX.utils.book_append_sheet` + `XLSX.writeFile`, exatamente como o `exportarNaoEncontrados` já faz no mesmo arquivo.
