## Objetivo

Marcar como lidas todas as publicações da **Coordenação Dr. Thomás** com `data_disponibilizacao < 02/06/2026` que ainda estão como não lidas.

## Escopo identificado

- Coordenação: `Coordenação Dr. Thomás` (id `b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f`)
- Usuária executora: Dra. Katarine Dias (id `8bf8b0a9-bdbd-4be9-82a7-2109261e02c2`)
- Total atual a atualizar: **232 publicações** não lidas no critério.

## Observação importante

A tabela `publicacoes_djen` só tem o campo booleano `lida` — **não existe coluna `lida_por`/`lida_em`** para registrar quem leu. Portanto, a ação será marcar `lida = true` em lote. O nome da Dra. Katarine não fica gravado em lugar nenhum.

Se quiser registro auditável de "quem marcou como lida", preciso primeiro criar colunas `lida_por uuid` e `lida_em timestamptz` em `publicacoes_djen` antes do update. Me avise se quer essa rastreabilidade — caso contrário, sigo com o update simples abaixo.

## Migração (update em lote)

```sql
UPDATE public.publicacoes_djen
SET lida = true
WHERE coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'
  AND data_disponibilizacao < '2026-06-02'
  AND lida = false;
```

Sem alterações de código nem de UI.
