

# Plano: Cancelar DJEN Processos + Indicador Global de Progresso

## Problema
1. O DJEN Processos está rodando em background (grupo 128/4138, 8 workers paralelos) e competindo com o DJEN Termos Pro pela API PJE Comunica, causando erros 429
2. O progresso do DJEN Processos só é visível na página de Configurações — em nenhum outro lugar do sistema

## Ações

### 1. Cancelar DJEN Processos imediatamente
- Chamar `forceKillDjenProcessos()` e atualizar metadata no banco para `status: 'cancelado'`
- Limpar o scheduler para que não reinicie automaticamente

### 2. Criar indicador flutuante global (`MonitoramentosFloatingIndicator.tsx`)
Componente fixo no canto inferior-direito, visível em **todas as páginas**:
- Aparece quando qualquer engine DJEN está ativo (Processos, Termos Pro, Termos)
- Mostra: nome do engine, barra de progresso compacta, percentual, tempo decorrido
- Minimizável (pill com badge "N ativos" → expandir para detalhes)
- Botão para navegar à tela de Configurações
- Desaparece quando nenhum engine está ativo

### 3. Integrar no MainLayout
- Adicionar `<MonitoramentosFloatingIndicator />` em `src/components/layout/MainLayout.tsx`
- Usar hooks existentes: `useDjenProcessos()`, subscriber do Termos Pro, e query de `execucoes_agendadas`

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/layout/MonitoramentosFloatingIndicator.tsx` | Criar — widget flutuante com progresso |
| `src/components/layout/MainLayout.tsx` | Modificar — adicionar o indicador |
| `src/hooks/useDjenProcessosEngine.ts` | Nenhuma mudança de código, apenas invocar `forceKill` |

## Detalhes Técnicos

O indicador usará:
- `useDjenProcessos()` para estado do engine de Processos
- `subscribeDjenTermosPro()` (ou polling de `configuracoes_monitoramento`) para Termos Pro
- Query em `execucoes_agendadas` com `status = 'executando'` para detectar execuções backend
- `useNavigate()` para link rápido à Configurações

Visual: pill compacta com ícone pulsante → clique expande mini-card com detalhes de cada engine ativo.

