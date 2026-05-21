## Excluir publicações DJEN de hoje das duas coordenações da Dra. Vanessa Gomes

**Alvo identificado**
- Coordenação Dra. Vanessa Gomes - TST → `b6a3a750-3109-4962-bea9-7b5116e3a4fd` → **141 publicações** hoje
- Coordenação Dra. Vanessa Gomes - STF / STJ → `6324396e-487a-4b4b-8bae-aacb3bb161bc` → **13 publicações** hoje
- **Total: 154 publicações** a excluir (data de hoje, BRT)

**Ação (via migration de DELETE)**

```sql
DELETE FROM publicacoes_djen
WHERE created_at >= (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')
  AND monitoramento_id IN (
    SELECT id FROM monitoramentos_djen
    WHERE coordenacao_id IN (
      'b6a3a750-3109-4962-bea9-7b5116e3a4fd',
      '6324396e-487a-4b4b-8bae-aacb3bb161bc'
    )
  );
```

**Escopo / fora de escopo**
- Exclui apenas `publicacoes_djen` (não mexe em `publicacoes_djen_descartadas`, monitoramentos, notificações ou histórico).
- Critério "hoje" = a partir das 00:00 BRT do dia atual.
- Não altera o flag `buscar_parte` dos monitoramentos — você vai reexecutar a busca após a limpeza.

Confirma para eu executar a migration?