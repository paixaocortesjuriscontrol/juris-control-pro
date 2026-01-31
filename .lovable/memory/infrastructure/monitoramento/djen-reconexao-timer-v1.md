# Memory: infrastructure/monitoramento/djen-reconexao-timer-v1
Updated: now

## Problema
Quando o usuário sai da página e volta durante uma execução DJEN:
1. O timer parava (tempo travado)
2. O termo atual desaparecia
3. O progresso não atualizava

## Causa raiz
O timer dependia de `executando` (estado booleano do hook), que é `false` ao remontar o componente. O hook não reconectava ao estado de execução ativa no banco.

## Solução implementada

### 1. Reconexão automática ao estado de execução
O `useEffect` de validação agora:
- Busca `detalhes` da execução ativa (inclui `termoAtual`, `processados`, `total`)
- Reconstrói o `tempoInicio` a partir de `iniciado_em`
- Seta `progresso.status = 'executando'` para que o timer inicie

### 2. Timer independente do loop local
O timer agora roda se:
- `progresso.status === 'executando'` E
- `progresso.tempoInicio` está definido

Isso permite que o timer funcione mesmo que `executando = false` (hook desmontou).

### 3. Persistência do termo atual
O `termoAtual` é agora salvo em:
- `configuracoes_monitoramento.metadata.termoAtual`
- `execucoes_agendadas.detalhes.termoAtual`

### 4. Leitura multi-fonte no card
O card busca `termoAtual` na ordem:
1. Loop local (`progresso.termoAtual`)
2. Snapshot localStorage (`savedState.termoAtual`)
3. Backend metadata (`md.termoAtual`)
