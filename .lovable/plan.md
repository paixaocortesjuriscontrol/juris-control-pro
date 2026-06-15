## Objetivo

Tornar a página **DJEN Servidor** equivalente ao card **DJEN Termos Paralela** do browser:
- Filtros de **data início / fim**, **coordenação** e **termo** antes de disparar
- Acompanhamento em **tempo real** com **barra de progresso por tribunal** (mesmo visual)

## Mudanças

### 1. Banco — `execucoes_servidor`

Adicionar colunas para o worker publicar progresso estruturado:
- `progresso jsonb` — `{ totalTribunais, concluidos, falhas, porTribunal: [{tribunal, status, processadas, total}] }`
- `progresso_atualizado_em timestamptz`

Habilitar **Realtime** em `execucoes_servidor` para a UI receber updates ao vivo.

### 2. UI — `src/pages/DjenServidor.tsx`

Substituir o `ConfigCard` atual por um `ExecucaoServidorCard` por engine (Paralela / Kurier / Pautas) contendo:
- Toggle ativo + agendamento (como hoje)
- Filtros **Coordenação** e **Termo** (mesmo `useCoordenacoesFull` + query de `monitoramentos_djen`)
- Datepickers **Início** / **Fim** (Calendar + Popover, default = hoje)
- Botão **Executar agora** que enfileira em `execucoes_servidor` com `payload = { dataInicio, dataFim, coordenacaoId, monitoramentoIds }`
- **Status ao vivo** da execução em andamento (assina Realtime), exibindo:
  - Header colorido (idle / executando / concluído / erro)
  - **Barra de progresso por tribunal** (lista) usando o mesmo visual do `MonitoramentoTermosParalelaCard` (Progress + Badge por status)
  - Contadores: tribunais concluídos / total, processadas / total geral

Reusar `Progress`, `Badge`, `Calendar`, `Popover` já existentes — manter design tokens, sem hardcode de cores.

### 3. Hook — `src/hooks/useDjenServidor.ts`

- Estender `useEnfileirarManual` para aceitar `payload` opcional ({ dataInicio, dataFim, coordenacaoId, monitoramentoIds })
- Novo `useExecucaoServidorAoVivo(tipo)` — devolve a execução `pendente`/`executando` mais recente daquele tipo, assinando Realtime de `execucoes_servidor` para refletir `progresso` e `status`

### 4. Worker VPS — `monitor-servidor/`

- `index.js`: passar `payload` (com datas/filtros) e helper `reportProgress(partial)` que faz `update` em `execucoes_servidor.progresso`
- `engines/paralela.js`, `engines/kurier.js`, `engines/pautas.js`: aceitar `payload.dataInicio`/`dataFim`/`coordenacaoId`/`monitoramentoIds` (defaults = hoje, sem filtro) e chamar `reportProgress` ao iniciar cada tribunal, ao finalizar e em intervalos (throttle 1s)

### 5. Pós-deploy no VPS

Usuário rodará no servidor:
```bash
cd /opt/juris-control-pro && git pull && cd monitor-servidor && npm install && pm2 restart jc-monitor-servidor
```

## Observações técnicas

- A página atual já tem aba **Execuções** que continua existindo (lista histórica). A novidade é o card "ao vivo" embutido em **Visão geral** com o mesmo visual do Paralela.
- O worker hoje processa tudo no dia atual sem filtros. Vou preservar esse comportamento como **default** quando `payload` vier vazio (compatível com o agendador automático).
- `progresso` é jsonb livre — não precisa de migração futura para mudar formato.

## Ordem de execução

1. Migration (adicionar colunas + realtime)
2. Atualizar worker (`monitor-servidor/index.js` + engines) para emitir progresso
3. Atualizar hook `useDjenServidor.ts`
4. Refatorar `DjenServidor.tsx` com filtros + card ao vivo
