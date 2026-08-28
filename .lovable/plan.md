# Corrigir divergência do card "Pronto sem pendência" (Distribuição TST)

## O que está acontecendo

O card conta uma coisa e a lista mostra outra porque cada um calcula as pendências sobre um objeto diferente:

- O card (`useProntoSemPendenciaCount`) calcula sobre a linha crua de `dados_benner`, que inclui o campo `acordo`. Pela regra atual, processo com **Acordo = SIM** é isento e entra como "Sem pendências".
- A tabela recalcula as pendências sobre o objeto já mapeado pela função `bennerToDistribuicao`, e esse objeto **não copia o campo `acordo`**. Sem ele, a isenção não se aplica e a linha volta a exibir "1 pendência", "4 pendências" (Equipe, Tipo de Recurso, Matérias, Chance de Êxito), mesmo tendo sido contada como pronta.

Verificado no banco: existem hoje 15 processos com status "Pronto para enviar" e Acordo = SIM, sendo 4 deles sem Equipe preenchida — exatamente o padrão de badges vermelhos da tela.

## Correção

1. Incluir `acordo` no objeto mapeado da Distribuição TST (mapeamento e tipo), para que a lista aplique a mesma isenção do card.
2. Alinhar a consulta do card com o motor de regras: incluir também `materias_analise_terceiro` nas colunas buscadas, evitando cálculo incompleto em recursos de terceiro.
3. Reconferir na tela: ao clicar no card, todas as linhas devem exibir "Sem pendências"; o botão "Verificar Pendências" nesse mesmo conjunto não deve listar nenhuma pendência bloqueante.

## Detalhes técnicos

- `src/hooks/useDistribuicoesTst.ts`: adicionar `acordo: !!b.acordo` em `bennerToDistribuicao` e `acordo?: boolean | null` na interface `DistribuicaoTst`. A listagem já usa `select("*")`, então o dado chega do banco — só não era propagado.
- `src/hooks/useProntoSemPendenciaCount.ts`: acrescentar `"materias_analise_terceiro"` à lista de colunas.
- Nenhuma mudança de regra de negócio: a isenção por Acordo/CEJUSC/Segredo/Outro escritório/Trânsito continua a mesma, definida em `src/utils/distribuicaoTstPendencias.ts`.
