# Memory: infrastructure/monitoramento/retomada-checkpoint-apos-erro-v1
Updated: 02/02/2026

## Retomada de Checkpoint após Erro/Timeout

O card DJEN Termos agora exibe alertas interativos com ações diretas quando há checkpoint disponível:

### Cenário 1: Execução Órfã (aba fechada durante execução)
- Detectada quando: engine local parado + banco com status "executando" há mais de 10 min
- Alerta vermelho com duas ações:
  - **Continuar de X%**: Limpa estado órfão e retoma de onde parou
  - **Limpar e Reiniciar**: Force kill total e permite nova execução do zero

### Cenário 2: Erro/Cancelamento/Timeout com Checkpoint
- Detectada quando: não está rodando + checkpoint válido no localStorage + status é erro/cancelado/timeout
- Alerta amarelo/accent com duas ações:
  - **Continuar de X%**: Retoma de onde parou usando checkpoint
  - **Reiniciar do Zero**: Force kill e nova execução limpa

### Botões de Controle Melhorados
- **Limpar** (RotateCcw): Limpa publicações do intervalo selecionado (variante outline visível)
- **Reset** (Skull): Botão vermelho sempre visível para forçar cancelamento total

### Fluxo do Checkpoint
1. Checkpoint salvo no localStorage após cada termo processado
2. Contém: runKey, diaIndice, termoIndice, contadores, datas início/fim
3. Expira após 24 horas automaticamente
4. Force kill limpa o checkpoint; retomar usa o checkpoint existente
