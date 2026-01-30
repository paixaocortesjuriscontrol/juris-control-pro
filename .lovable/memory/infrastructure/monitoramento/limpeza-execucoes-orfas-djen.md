# Memory: infrastructure/monitoramento/limpeza-execucoes-orfas-djen
Updated: now

Para resolver o problema de monitoramentos do DJEN que travam no frontend (ficando "órfãos" no banco de dados), foi implementado um sistema robusto de detecção e limpeza:

## Detecção de Execuções Órfãs
O `DjenTermosDashboardCard.tsx` possui um `useEffect` que verifica diretamente o banco de dados a cada 5 segundos:

1. **Verificação direta**: Busca execuções do tipo 'djen' com `status='executando'` e `finalizado_em=null`
2. **Threshold de 2 minutos**: Se a execução tem mais de 2 minutos e não há loop local ativo (`!localRunActive`), é considerada órfã
3. **Estado reativo**: A variável `execucaoOrfaNoBanco` armazena o ID da execução órfã detectada

## Botão "Forçar Cancelamento" (Ícone Caveira 💀)
- Aparece quando `execucaoOrfa = !!execucaoOrfaNoBanco && !localRunActive`
- Permite ao usuário cancelar manualmente execuções travadas
- Atualiza o banco diretamente com `status='cancelado'` e limpa o metadata

## Auto-Limpeza Automática
- Execuções órfãs com mais de **10 minutos** são automaticamente marcadas como `timeout`
- O sistema limpa tanto a `execucoes_agendadas` quanto o `metadata` da configuração

## Robustez no Hook
O hook `useBuscaDjenDireta` foi reforçado com:
- Blocos `try/finally` para garantir atualização do banco mesmo em falhas
- A função `registrarExecucao` sempre finaliza o registro no banco

## Fluxo de Detecção
```
useEffect (a cada 5s) → Verifica banco → Se execução ativa E loop não roda localmente:
  - Se 2+ minutos: setExecucaoOrfaNoBanco(id) → Mostra botão caveira
  - Se 10+ minutos: Auto-limpa e notifica
```
