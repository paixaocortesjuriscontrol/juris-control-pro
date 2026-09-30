# Reclamação da Lienne: matérias verdes no processo 0000442-30.2025.5.06.0411

## Diagnóstico (conferido no banco)
A reclamação procede, mas o problema está no número do dossiê, não nas matérias.
- Na Distribuição TST, o processo está cadastrado com o dossiê **07.02.482.0004356802/25**.
- Na lista de pedidos da Dra. Iara (carga de 16/09/2026), esse processo aparece como **07.02.033.0004356802/25**, com 24 matérias.
- O miolo do número é diferente (482 x 033). Por isso o sistema não encontra a lista e não pinta nenhuma matéria de verde.
- Há **36 processos** na mesma situação: o final do dossiê é igual ao da lista, mas o miolo é diferente.

## O que fazer (a escolher na aprovação)
1. Gerar uma planilha com os 36 casos (processo, dossiê no sistema, dossiê na lista da Dra. Iara, quantidade de matérias) para a Lienne conferir.
2. Depois da confirmação, corrigir o dossiê desses processos para o número da lista da Dra. Iara. Assim as matérias verdes aparecem na hora e os processos entram na planilha de Carga Benner.

Não vou mudar a regra de comparação para "casar só pelo final": isso poderia misturar matérias de dossiês diferentes.

## Detalhes técnicos
- Comparação atual: igualdade exata entre `dados_benner.dossie` e `pedidos_por_dossie.dossie`.
- Critério da divergência: mesmo 4º segmento (`split_part(dossie,'.',4)`), dossiê diferente, sem lista para o dossiê do sistema.
- Correção: UPDATE em `dados_benner.dossie` só nos IDs aprovados (a auditoria existente registra a alteração).
