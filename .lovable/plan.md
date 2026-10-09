# Corrigir processos com dois números na mesma linha (Coordenação GOL)

## Causa confirmada
A planilha de origem (SUCESSÃO - RELATÓRIO SETEMBRO 2026 e demais) já trazia dois números de processo na mesma célula, separados por " / " (ex.: GOL61265). A importação gravou o texto como estava. Foram encontrados 12 registros assim na base (10 da importação GOL, 4 antigos sem dossiê — um registro GOL tem 3 números).

## O que será feito

1. **Listar os 12 registros** com número no padrão `CNJ / CNJ` e gerar planilha de conferência antes de alterar.
2. **Para cada registro:**
   - Manter na ficha o **primeiro número** (geralmente o processo principal/mais antigo) no campo Número do Processo.
   - Gravar os **números adicionais** no campo `processos_relacionados` da mesma ficha, para que continuem visíveis e pesquisáveis.
   - Registrar em observação técnica da ficha: "Número original da planilha: X / Y — separado em DD/MM/AAAA".
3. **Nenhum processo será excluído nem duplicado** — apenas separação do número principal e dos relacionados.
4. **Validação:** conferir que buscas por qualquer um dos números localizam a ficha e que a busca Judit passa a funcionar com o número principal.

## Detalhes técnicos
- Tabela `processos`, coluna `numero`; números extras em `processos_relacionados` (campo já existente).
- Padrão detectado por regex CNJ: `\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}`.
- Números antigos no formato físico (ex.: `46220.005076/2016-11`) NÃO serão tocados — a barra faz parte do número.
- Relatório Excel de conferência entregue ao final.
