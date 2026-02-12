
# Agendamento Automático Simples - DJEN Termos (05:30 BRT)

## Objetivo
Adicionar um scheduler muito simples que dispara a execução do DJEN Termos automaticamente às **05:30 BRT** todos os dias, **somente se não houver execução em andamento**. Sem retry automático (já existe no monitoramento).

## Arquitetura Simplificada

### 1. Novo Hook: `src/hooks/useDjenTermosScheduler.ts`
Um singleton simples que:
- Roda `setInterval(30000)` = verifica a cada 30 segundos
- Converte horário BRT atual e compara com 05:30 BRT (margem: ±2 minutos)
- Se bateu o horário:
  - Verifica se `isDjenTermosRunning()` = true → pula (já executando)
  - Verifica se existe execução ativa em `execucoes_agendadas` → pula
  - Senão: dispara `executarDjenTermos()`
  - Marca no `localStorage` que executou naquele horário hoje para evitar duplicata
- API pública:
  - `startDjenTermosScheduler()` / `stopDjenTermosScheduler()`
  - `getDjenTermosSchedulerStatus()` → retorna `{ ativo, proximoHorario, proximaExecucao }`
  - `subscribeDjenTermosScheduler(listener)` → para reatividade

### 2. Modificar: `src/components/configuracoes/DjenTermosDashboardCardV2.tsx`
Adicionar seção simples **abaixo** dos botões principais:
- Toggle "Agendamento automático" com switch (onOff)
- Texto: "Executa automaticamente todos os dias às 05:30 BRT"
- Badge mostrando "Próxima execução: HH:mm de hoje/amanhã"
- Aviso pequeno: "Mantenha esta aba aberta"
- Ao clicar no toggle, chama `startDjenTermosScheduler()` ou `stopDjenTermosScheduler()`
- Status React via `useDjenTermosScheduler()`

### 3. Modificar: `src/components/layout/MainLayout.tsx`
Inicializa o scheduler ao montar a aplicação:
```typescript
useEffect(() => {
  const preferencia = localStorage.getItem('djen-termos-scheduler-enabled') === 'true';
  if (preferencia) {
    startDjenTermosScheduler();
  }
  return () => stopDjenTermosScheduler();
}, []);
```

## Fluxo Simplificado

```text
setInterval(30s)
  ↓
Hora BRT agora == 05:30? (±2min)
  ↓
  NÃO → próximo ciclo
  SIM
    ↓
    isDjenTermosRunning() == true?
      SIM → pular (já executando)
      NÃO
        ↓
        Existe execução ativa em execucoes_agendadas?
          SIM → pular
          NÃO
            ↓
            Já executou neste horário hoje? (localStorage)
              SIM → pular
              NÃO
                ↓
                executarDjenTermos() [sem parâmetros = últimas 24h padrão]
                marcar localStorage como executado hoje
```

## Persistência
- `djen-termos-scheduler-enabled`: boolean no localStorage
- `djen-termos-scheduler-last-run-{YYYY-MM-DD}`: timestamp de última execução do dia

## Detalhes Técnicos

### Conversão BRT
```typescript
const horaAtualBrt = new Date(Date.now() - 3 * 60 * 60 * 1000); // UTC-3
const [h, m] = [horaAtualBrt.getHours(), horaAtualBrt.getMinutes()];
const ehAgora = (h === 5 && m >= 28 && m <= 32); // 05:30 ±2min
```

### Verificação de Execução Existente
Dupla verificação (local + banco):
```typescript
// Local: engine running?
if (isDjenTermosRunning()) return; // skip

// Banco: execução ativa?
const { data } = await supabase
  .from('execucoes_agendadas')
  .select('id')
  .eq('tipo', 'djen')
  .eq('status', 'executando')
  .is('finalizado_em', null)
  .limit(1);
if (data?.length > 0) return; // skip
```

## Diferenças do Plano Anterior
✅ Sem retry automático (já existe no monitoramento)  
✅ Apenas dispara a rotina existente (sem mexer em lógica)  
✅ Horário fixo: 05:30 BRT  
✅ UI simples: toggle + badge  
✅ Verificação: não permite duplicata (executando check)  

## Arquivos a criar/modificar
- **Novo**: `src/hooks/useDjenTermosScheduler.ts`
- **Modifica**: `src/components/configuracoes/DjenTermosDashboardCardV2.tsx` (adiciona seção de agendamento)
- **Modifica**: `src/components/layout/MainLayout.tsx` (inicializa scheduler)
