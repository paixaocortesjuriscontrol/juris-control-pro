# Minutado - Revisão: deixa de contar como "prazo perdido" no Ranking

## Contexto
- Pergunta da Dra. Janaina: se estagiário/assistente usa "Minutado - Revisão", entra na avaliação?
- Regra atual (função `get_ranking_atendimento_geral`): "Minutado - Revisão" não conta como concluído (só cumprido, tratado, protocolado, baixado, verificado e concluído sem sucesso contam).
- Problema: na cláusula de "prazos perdidos", a função só exclui as situações finais; um item em "minutado_revisao" que passou da data entra na coluna "Prazos perdidos".
- Decisão do usuário: Minutado - Revisão NÃO conta como concluído; só deixa de contar como perdido.

## Mudança
Migration SQL (única) recriando `public.get_ranking_atendimento_geral(date, date, uuid, uuid)` exatamente como está hoje, com uma alteração na cláusula `perdidos`:

```sql
AND status NOT IN ('cumprido','tratado','protocolado','baixado','verificado',
                   'cancelado','concluido_sem_sucesso','minutado_revisao')
```

- Nada muda em "Concluídos", "% no prazo", "Abertos" ou atividades.
- `get_ranking_atendimento_tst` não usa situações de tarefas — sem alteração.
- Nenhuma tela muda; nenhum dado é alterado (hoje não há itens em minutado_revisao).

## Validação
- Comparar `prazos_perdidos` antes/depois da migration para um período com itens vencidos (ex.: últimos 90 dias, Dra. Beatriz Costa): só pode diminuir ou manter.
- Conferir que o resto do resultado da função permanece idêntico (mesmas linhas e colunas).
