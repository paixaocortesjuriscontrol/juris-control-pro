# Matérias por processo OU dossiê (Distribuição TST)

## Pedido
A Lienne perguntou se o sistema pode considerar as matérias cadastradas quando **o número do processo OU o dossiê** estiver correto — hoje só o dossiê é usado, e dossiês divergentes (ex.: 482 x 033) deixam as matérias sem o verde.

## Situação atual (confirmada)
- A lista de matérias da Dra. Iara fica na tabela `pedidos_por_dossie`, localizada **somente pelo dossiê exato** (`pedidosDoDossieSync` em `src/utils/pedidosPorDossieCache.ts`, usado em `src/utils/distribuicaoTstPendencias.ts` e na ficha do processo).
- A tabela `dados_benner` tem as colunas `processo` e `dossie`, ou seja, dá para achar o dossiê certo a partir do número do processo.
- Existem 36 processos com dossiê divergente da lista da Dra. Iara (planilha já entregue para conferência).

## O que será feito

1. **Busca em duas vias na lista de matérias**
   - Ao procurar a lista de matérias de um processo, o sistema tenta primeiro pelo dossiê (como hoje).
   - Se não achar, busca em `dados_benner` pelo **número do processo** (comparando só os dígitos, ignorando pontos/traços) e usa o dossiê encontrado lá para localizar a lista.
   - Se um dos dois caminhos encontrar a lista, as matérias ficam verdes normalmente.

2. **Sem alterar dados gravados**
   - Nenhum dossiê será corrigido automaticamente; a divergência continua visível na planilha de conferência já entregue.
   - A troca definitiva dos 36 dossiês divergentes continua como opção separada, aguardando a conferência da Lienne.

3. **Desempenho**
   - A consulta extra por processo só acontece quando a busca por dossiê falha, e usa o cache em memória já existente para não repetir consultas.

## Detalhes técnicos
- `src/utils/pedidosPorDossieCache.ts`: nova função de resolução dossiê-por-processo (consulta `dados_benner` por dígitos do processo, com cache).
- `src/utils/distribuicaoTstPendencias.ts` e `src/components/distribuicao-tst/DistribuicaoTstDetail.tsx`: passam a usar a resolução em duas vias.
- Comparação de processo por dígitos, mesmo padrão já usado em `find_processo_by_digits`.
