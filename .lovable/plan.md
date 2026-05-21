## Objetivo

Liberar a publicação `0010074-58.2007.8.26.0038` (e quaisquer outras presas pelo mesmo motivo) para que, ao reexecutar o DJEN Paralela na janela 19/05/2026, o novo monitoramento `PALAVRA-CHAVE - UNIÃO QUÍMICA` (criado em 20/05) consiga capturá-la.

## Diagnóstico confirmado

- Coordenação Dr. Thomás: `b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f`
- Descartadas dessa coordenação com `data_publicacao = 19/05/2026`: **7.485 registros**
- A dedupe do engine usa `hash_conteudo` em descartadas → enquanto o hash existir lá, a publicação nunca será reavaliada por monitoramentos novos.

## Passos

### 1. Apagar descartadas alvo (via migration de DELETE filtrado)

Critério: somente descartadas vinculadas a monitoramentos da coordenação Dr. Thomás, com `data_publicacao = 2026-05-19`.

```sql
DELETE FROM publicacoes_djen_descartadas d
USING monitoramentos_djen m
WHERE d.monitoramento_id = m.id
  AND m.coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'
  AND d.data_publicacao::date = '2026-05-19';
```

Escopo previsto: ~7.485 linhas. Não toca em outras coordenações, outras datas, nem na tabela `publicacoes_djen` (válidas).

### 2. Reexecutar o DJEN Termos Paralela

Após o DELETE, você executa manualmente em `MonitoramentoDjen`:
- Coordenação: Dr. Thomás
- Janela: **19/05/2026 a 19/05/2026**
- Sem filtro de monitoramento (deixa todos ativos), assim o novo `UNIÃO QUÍMICA` participa do passe.

### 3. Verificação

Após a execução, conferir:

```sql
SELECT id, processo_numero, data_publicacao, monitoramento_id, created_at
FROM publicacoes_djen
WHERE processo_numero LIKE '%0010074-58.2007.8.26.0038%'
ORDER BY created_at DESC;
```

Esperado: pelo menos um registro vinculado ao monitoramento `94c34b0e...` (UNIÃO QUÍMICA).

## Riscos e ressalvas

- **Reprocessamento**: o Paralela vai chamar a API DJEN novamente para o dia 19 da coordenação inteira → consome quota e tempo, mas é necessário.
- **Monitoramentos antigos continuam descartando**: publicações que originalmente caíram por exclusão (ex.: `BRADESCO`) voltarão a ser descartadas pelos mesmos monitoramentos antigos — isso é esperado e correto. O ganho é que o monitoramento novo (`UNIÃO QUÍMICA`) agora também é avaliado e salva o que casar.
- **Sem alteração de código**: este plano é apenas operacional (DELETE + reexecução manual). O resgate inline no engine Paralela continua sendo a solução definitiva para o futuro — pode ser feito num próximo passo separado.

## Detalhes técnicos

- Tabela: `publicacoes_djen_descartadas`
- Join: `monitoramentos_djen.coordenacao_id`
- Filtro de data: `data_publicacao` (não `created_at`), porque o critério é o dia da publicação no DJEN.
- Migration tipo DELETE (não DDL) — será executada como migration porque é uma operação destrutiva controlada.
