# Memory: features/monitoring/djen-termos-engine-v2
Updated: 01/02/2026

## Arquitetura Singleton DJEN Termos

O sistema de monitoramento DJEN Termos foi completamente reescrito com uma arquitetura singleton que:

### Características Principais:
1. **Execução em Background**: Continua rodando mesmo ao sair da tela de Configurações
2. **1 Dia por Vez**: Processa completamente todos os termos de um dia antes de avançar para o próximo
3. **Progresso Global + Dia**: Percentual é `(diasCompletos × termos + termosDoDiaAtual) / (totalDias × termos)`
4. **Retomada Manual**: Sem auto-restart - o usuário decide quando retomar

### Arquivos:
- `src/hooks/useDjenTermosEngine.ts`: Engine singleton com estado global
- `src/hooks/useDjenTermos.ts`: Hook React que conecta ao engine
- `src/components/configuracoes/DjenTermosDashboardCardV2.tsx`: Card simplificado

### Checkpoint:
- Salvo em localStorage após cada termo processado
- Contém: runKey, diaIndice, termoIndice, novas, duplicadas, descartadas
- Expira após 24 horas

### API Pública:
```typescript
executarDjenTermos(dataInicioYmd?, dataFimYmd?, retomar?)
cancelarDjenTermos()
limparEstadoDjenTermos()
forceKillDjenTermos()  // Kill switch total
subscribeDjenTermos(listener)  // Para UI reativa
```

### Fluxo de Execução:
1. Gera lista de datas (início → fim)
2. Para cada dia:
   - Para cada termo ativo:
     - Busca publicações no PJE Comunica
     - Valida e deduplica
     - Salva checkpoint
     - Atualiza progresso
   - Ao concluir dia, avança para o próximo
3. Ao concluir todos os dias, limpa checkpoint
