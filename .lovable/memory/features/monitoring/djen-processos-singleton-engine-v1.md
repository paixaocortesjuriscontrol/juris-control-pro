# Memory: features/monitoring/djen-processos-singleton-engine-v1
Updated: 2026-02-04

## Arquitetura Singleton DJEN Processos

O sistema de monitoramento DJEN Processos foi completamente refatorado para usar uma arquitetura singleton similar ao DJEN Termos:

### Características Principais:
1. **Execução em Background**: Continua rodando mesmo ao sair da tela de Configurações
2. **Exclusão Santander**: Coordenações Santander Cível e Trabalhista excluídas (~11k processos)
3. **Grupos de 10**: Processos agrupados com sintaxe OR do Elasticsearch
4. **Checkpoints a cada 5 grupos**: Para retomada exata em caso de falha
5. **Retomada Manual**: Usuário decide quando continuar via botão "Continuar"

### Coordenações Excluídas:
```typescript
const COORDENACOES_EXCLUIDAS = [
  '968631d0-6659-46f1-b45d-899892cb0121', // Santander Cível (~10.736 processos)
  '70d3e1ba-70ff-46d0-a6cf-4d4b553d324a', // Santander Trabalhista (~998 processos)
];
```

**Impacto:** De ~13.210 processos para ~2.474 (redução de 81%)

### Arquivos:
- `src/hooks/useDjenProcessosEngine.ts`: Engine singleton com estado global
- `src/hooks/useDjenProcessos.ts`: Hook React que conecta ao engine
- `src/components/configuracoes/MonitoramentoDjenProcessosCard.tsx`: Card atualizado

### Checkpoint:
- Salvo em localStorage (`djen-processos-checkpoint-v1`) após cada 5 grupos
- Contém: runKey, grupoIdx, novas, duplicadas, totalAnalisadas
- Expira após 24 horas

### API Pública:
```typescript
executarDjenProcessos(dataInicio?, dataFim?, retomar?)
cancelarDjenProcessos()
limparEstadoDjenProcessos()
forceKillDjenProcessos()  // Kill switch total
subscribeDjenProcessos(listener)  // Para UI reativa
getDjenProcessosProgress() → DjenProcessosProgress
isDjenProcessosRunning() → boolean
getCheckpointProcessos() → Checkpoint | null
```

### Metadata no Banco:
Atualizado em `configuracoes_monitoramento` tipo `djen_processos`:
```json
{
  "status": "executando" | "concluido" | "cancelado" | "erro",
  "grupo_atual": 150,
  "total_grupos": 248,
  "percentage": 60,
  "novas": 12,
  "duplicadas": 45,
  "run_key": "2026-02-04..2026-02-04",
  "browser_execution": true,
  "estrategia": "singleton_engine_v1"
}
```

### Benefícios:
| Aspecto | Antes | Depois |
|---------|-------|--------|
| Processos | ~13.210 | ~2.474 |
| Grupos (÷10) | ~1.321 | ~248 |
| Tempo estimado | 40-60 min | ~10 min |
| Persiste ao sair? | Não | Sim |
| Checkpoint | Parcial | Completo |
| Retomada | Limitada | Total |
