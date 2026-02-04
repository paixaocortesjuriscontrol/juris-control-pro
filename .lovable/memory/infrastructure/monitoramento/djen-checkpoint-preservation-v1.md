# Memory: infrastructure/monitoramento/djen-checkpoint-preservation-v1
Updated: 04/02/2026

## Preservação de Checkpoint após Force Kill

### Comportamento Anterior
O botão "Caveira" (force kill) limpava o checkpoint do localStorage, impossibilitando retomada após cancelamento forçado.

### Comportamento Atual
- **Force Kill (Caveira)**: Para a execução mas **PRESERVA o checkpoint**
- Ao clicar em "Executar" após o force kill, o sistema detecta o checkpoint e exibe o dialog de confirmação:
  - "Continuar de X%" → Usa o checkpoint existente
  - "Nova Execução" → Inicia do zero (limpa checkpoint implicitamente)

### Funções Alteradas

```typescript
// useDjenTermosEngine.ts
export function forceKillDjenTermos(clearCheckpoint = false) {
  // ... para a execução ...
  if (clearCheckpoint) {
    saveCheckpoint(null); // Só limpa se explicitamente solicitado
  }
}

// useDjenTermos.ts
const forceKill = useCallback(async (clearCheckpoint = false) => {
  forceKillDjenTermos(clearCheckpoint);
  // ...
}, [queryClient]);

const forceKillHibrido = useCallback(async (clearCheckpoint = false) => {
  forceKillDjenTermos(clearCheckpoint);
  // ...
}, [queryClient]);
```

### Quando o Checkpoint é Limpo

1. **Ao iniciar nova execução do zero** (sem usar retomar)
2. **Ao usar "Limpar Tudo com Publicações"** (`limparTudoComPublicacoes`)
3. **Ao concluir execução com sucesso** (100%)

### Fluxo de Uso

1. Usuário está executando DJEN Termos (ex: 70%)
2. Execução trava ou precisa ser interrompida
3. Usuário clica na "Caveira" → Execução para, checkpoint preservado
4. Usuário clica em "Executar"
5. Dialog aparece: "Retomar de 70%" ou "Nova Execução"
6. Se retomar → continua de onde parou
7. Se nova → inicia do zero
