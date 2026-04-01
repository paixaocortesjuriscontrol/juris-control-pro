

# Diagnóstico: DJEN Termos Pro caindo em Rate Limit

## Causa Raiz Encontrada

A tabela `execucoes_agendadas` tem uma constraint CHECK no campo `tipo` que **NÃO inclui `djen_pro`**:

```text
CHECK (tipo IN ('redistribuicoes','andamentos','distribuicoes','djen','djen_processos','termos','datajud_termos'))
```

O INSERT com `tipo: 'djen_pro'` falha silenciosamente. Sem registro no banco:
1. O scheduler verifica o banco e não encontra execução concluída hoje
2. Dispara nova execução a cada 30 segundos
3. Múltiplas execuções simultâneas sobrecarregam a API com 429s

## Ações

### 1. Adicionar `djen_pro` à constraint CHECK (migração SQL)
Alterar a constraint para incluir o novo tipo:
```sql
ALTER TABLE execucoes_agendadas DROP CONSTRAINT execucoes_agendadas_tipo_check;
ALTER TABLE execucoes_agendadas ADD CONSTRAINT execucoes_agendadas_tipo_check 
  CHECK (tipo = ANY (ARRAY['redistribuicoes','andamentos','distribuicoes','djen','djen_processos','termos','datajud_termos','djen_pro']));
```

### 2. Restaurar delays conservadores (useDjenTermosProEngine.ts)
O CONFIG atual usa 800ms entre termos e 800ms entre páginas (muito agressivo). Restaurar para valores seguros:
- `delay_between_terms`: 800 → 1500ms
- `delay_between_pages`: 800 → 1500ms
- `retry_base_delay`: 5000 → 10000ms

### 3. Cancelar execução duplicada atual
Forçar `cancelarDjenTermosPro()` para limpar o estado.

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Adicionar `djen_pro` à constraint CHECK |
| `src/hooks/useDjenTermosProEngine.ts` | Restaurar delays conservadores |

## Resultado Esperado
- INSERT funcionará, registrando execução no banco
- Scheduler não disparará execuções duplicadas
- API não será sobrecarregada com requisições excessivas

