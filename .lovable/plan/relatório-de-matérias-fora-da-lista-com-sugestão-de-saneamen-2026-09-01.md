# Relatório de matérias fora da lista com sugestão de saneamento

Gerar uma nova versão da planilha de análise (`Materias_Fora_Lista_Prontos.xlsx`) acrescentando, para cada matéria fora da lista oficial, uma coluna com a **sugestão de matéria oficial** correspondente.

## O que muda na planilha

Aba "Fora da Lista" — mesmas colunas de hoje (coordenação, processo, dossiê, status, parte recorrente, matérias fora separadas por Reclamante / Reclamada (Banco) / Terceiro) mais:

- **Sugestão de saneamento** — nome oficial sugerido para cada matéria fora da lista, na mesma ordem.
- **Confiança** — Alta / Média / Sem sugestão.

Aba "Resumo por Matéria" — passa a ter, por matéria fora da lista: quantidade de processos, sugestão oficial e confiança. Assim dá para aprovar o de-para em bloco.

Nova aba **"De-Para Sugerido"** — uma linha por matéria fora da lista distinta: matéria atual, sugestão oficial, confiança, nº de ocorrências. É a folha de aprovação para um eventual saneamento futuro.

## Como a sugestão é calculada

Comparação de cada matéria fora da lista contra as 249 matérias ativas de `materias_pedidos_oficiais`, com normalização (sem acentos, minúsculas, espaços colapsados) e:

1. Correspondência exata após remover palavras de ligação/ruído (ex.: "Horas extras intervalo intrajornada" -> "Horas extras intrajornada") — confiança Alta.
2. Similaridade por tokens + distância de edição, aceitando apenas acima de um limiar seguro — confiança Média.
3. Sem candidato acima do limiar — "Sem sugestão" (célula em vermelho), para tratamento manual.

Matérias claramente inexistentes na lista oficial (ex.: teses/decisões, "Outra Matéria") ficam como "Sem sugestão" em vez de receber um encaixe forçado.

## Escopo

Somente geração do arquivo Excel para análise. Nenhuma alteração no sistema, no banco ou na regra de rejeição da Carga Benner.
