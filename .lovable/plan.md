# Retirar o Santander Cível como coordenação responsável dos 859 processos restantes

## O que aconteceu
Os 859 processos da tela não são mais do Santander Cível. Eles pertencem a outras coordenações, mas ainda têm o Santander Cível na lista de "Coordenações responsáveis", e o filtro da tela conta essa lista:
- 855 são os processos movidos na limpeza (832 Santander Trabalhista, 22 Dra. Renata Oficial, 1 Dr. Thomás).
- 4 já eram de outras coordenações antes (2 Kurier paixaoc.08, 1 Santander Trabalhista, 1 Dr. Thomás).

## O que será feito
1. Guardar uma cópia desses 859 vínculos na área de backup da limpeza.
2. Retirar o Santander Cível da lista de coordenações responsáveis desses 859 processos.
3. O processo, os itens e as outras coordenações responsáveis continuam iguais.
4. Conferir que o filtro "Coordenação Santander Cível" passa a mostrar 0 processos.

## Detalhes técnicos
- Tabela `processos_coordenacoes_responsaveis`, filtro `coordenacao_id = 968631d0-6659-46f1-b45d-899892cb0121`.
- Backup em `backup_limpeza_santander.proc_coord_resp_restantes` antes da exclusão.
