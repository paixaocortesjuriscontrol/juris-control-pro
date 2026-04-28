Confirmei diretamente na Judit o processo 0100798-32.2021.5.01.0049.

Resultado da consulta:
- A Judit retornou 3 instâncias e 599 andamentos agregados.
- Os recursos realmente identificados como interpostos pela reclamante são: RO, ED, RR, ED e AgR.
- Não há andamento de interposição de recurso pelo banco/reclamada.
- O campo atual no banco está errado: `tipo_recurso_banco = RO`.

A origem do erro é específica: o sistema está olhando movimentos vizinhos de intimação para tentar descobrir o autor de andamentos genéricos. No andamento abaixo, ele classificou o RO como do banco por engano:

```text
2023-11-07 - RECEBIDO(S) O(S) RECURSO ORDINÁRIO DE MARCELA LAZARO PEREIRA SEM EFEITO SUSPENSIVO
movimento vizinho: EXPEDIDO(A) INTIMAÇÃO A(O) BANCO BMG SA
resultado incorreto atual: banco = RO
```

Esse movimento já diz expressamente que o recurso é de MARCELA LAZARO PEREIRA, então não pode usar a intimação ao banco para inverter/atribuir o recurso à reclamada.

Plano de correção:

1. Corrigir a regra de extração em `supabase/functions/buscar-judit/index.ts`
   - Antes de usar movimentos vizinhos/intimações, reconhecer expressões diretas como:
     - `RECURSO ... DE <nome da parte>`
     - `AGRAVO ... DE <nome da parte>`
     - `EMBARGOS ... DE <nome da parte>`
   - Se o texto mencionar nominalmente a reclamante como autora do recurso, atribuir à reclamante e não olhar intimações vizinhas.
   - Se mencionar nominalmente banco/reclamada como autora do recurso, atribuir ao banco.
   - Usar movimentos vizinhos apenas quando o movimento não tiver autor explícito.

2. Ajustar tokens de partes para reduzir falsos positivos
   - Não permitir que tokens genéricos/compartilhados, como `BANCO`, `MARCELA`, `LAZARO` quando aparecem em descrição composta `MARCELA X BANCO`, causem dupla marcação ou inversão.
   - Priorizar nome completo/documento/lado original em vez de palavras soltas quando o movimento traz autor claro.

3. Corrigir o registro existente desse processo
   - Atualizar `dados_benner` para o processo `0100798-32.2021.5.01.0049` removendo o `RO` do banco.
   - Resultado esperado:
     - `tipo_recurso_reclamante = RO + ED + RR + AgR`
     - `tipo_recurso_banco = NULL`
     - `tipo_recurso = RO + ED + RR + AgR`

4. Validar com a própria Judit
   - Rodar novamente a edge function `buscar-judit` para o processo.
   - Confirmar que o retorno não traz recurso para o banco.
   - Confirmar que o formulário não preserva valor antigo quando a Judit retorna vazio para banco.

5. Registrar a regra na memória do projeto
   - Atualizar a regra de atribuição Judit para deixar explícito: quando o movimento já informa `recurso de <parte>`, intimações vizinhas não podem mudar o recorrente.