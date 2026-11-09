## Planilha dos processos da GOL na Coordenação Dra. Janaina Catunda

Gerar uma planilha Excel com os **381 processos** da GOL nessa coordenação, sem alterar nada no sistema:
- 360 ativos e 6 encerrados da Gol Linhas Aéreas S/A
- 15 ativos da Gol Transportes Aéreos S/A

Colunas: Número do processo, Cliente, Status, Parte contrária, Pasta do cliente e Data de cadastro.

Datas no formato DD/MM/AAAA. O arquivo fica disponível para download aqui no chat.

### Detalhes técnicos
- Consulta somente leitura em `processos` + `clientes`, com `coordenacao_id = 9d4e11e2…` e nome do cliente contendo a palavra "GOL".
- Arquivo gerado com xlsxwriter em `/mnt/documents/processos_gol_coord_janaina.xlsx`.
