# Processos com dois números na mesma linha (Coordenação GOL)

## Causa confirmada
A planilha de origem (SUCESSÃO - RELATÓRIO SETEMBRO 2026 e demais) já trazia dois números de processo na mesma célula, separados por " / " (ex.: GOL61265). A importação gravou o texto como estava. Foram encontrados 12 registros assim na base: 8 da importação GOL de 09/10/2026 e 4 cadastros antigos (jan/2026) sem dossiê.

## Etapa 1 — Relatório para decisão da advogada (sem alterar nada)
Gerar e entregar a planilha **Casos_dois_numeros_mesma_linha.xlsx** com as 12 fichas:
- Dossiê, número gravado no sistema, números separados, parte (da planilha de origem), status e origem do cadastro.
- Coluna "Decisão da advogada" em branco para ela indicar, em cada caso, qual número é o principal.

## Etapa 2 — Correção (somente após a devolutiva da advogada)
Para cada ficha, conforme a decisão:
- Manter o número principal no campo Número do Processo.
- Gravar os demais números em `processos_relacionados` da mesma ficha, para continuarem visíveis e pesquisáveis.
- Registrar em observação técnica: "Número original da planilha: X / Y — separado em DD/MM/AAAA".
- Nenhum processo será excluído nem duplicado.

## Detalhes técnicos
- Tabela `processos`, coluna `numero`; números extras em `processos_relacionados` (campo já existente).
- Padrão detectado por regex CNJ: `\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}`.
- Números antigos no formato físico (ex.: `46220.005076/2016-11`) NÃO serão tocados — a barra faz parte do número.
