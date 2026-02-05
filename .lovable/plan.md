

# ✅ Plano Implementado: Progresso DJEN Termos por Tribunais

## Status: IMPLEMENTADO ✅

## Alterações Realizadas

### 1. Cálculo de `globalTotal` ponderado por tribunais
- Cada termo agora contribui com o número de tribunais que precisa processar
- `termoPesos = termos.map(t => Math.max(1, expandirTribunais(t.tribunais).length))`
- `globalTotal = totalDias * totalPesoTermos`

### 2. Callback `onTribunalProgress` em `processarTermo`
- Novo parâmetro opcional para reportar progresso granular
- Chamado após cada tribunal ser processado no loop

### 3. Atualização de progresso em tempo real
- UI atualiza a cada tribunal processado, não apenas por termo
- Mensagem mostra "X/Y tribunais" durante processamento
- Percentual limitado a 99% até conclusão total

### 4. Persistência no banco sincronizada
- `detalhes.progress` atualizado durante loop de tribunal
- Throttle de 3s mantido para reduzir carga no banco

## Resultado

**Antes:** 1 termo com 27 tribunais → barra em 100% instantaneamente
**Depois:** 1 termo com 27 tribunais → barra progride 0→99% conforme cada tribunal é processado, 100% só ao concluir

