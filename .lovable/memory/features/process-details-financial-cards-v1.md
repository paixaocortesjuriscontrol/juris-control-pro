# Memory: features/process-details-financial-cards-v1
Updated: 2026-01-28

A página de detalhes do processo foi reorganizada:

## Layout Atualizado
- **Coluna Esquerda**: Contém todas as informações do processo (Situação, Órgão, Envolvidos, Responsáveis, Valor da Ação) + campos adicionais que estavam na direita (Data de Distribuição, Órgão Julgador, Área, Fase, Sistema, Pasta Física, Descrição, Pasta do Cliente, Monitoramento)
- **Coluna Direita**: Três novos cards:
  1. **Pendências do Processo** - Exibe audiências, intimações e tarefas pendentes + últimos andamentos
  2. **Depósitos Recursais** - Lista de depósitos com data, título e valor. Permite adicionar/editar/excluir. Mostra soma total no header
  3. **Custas Processuais** - Lista de custas com data, descrição e valor. Permite adicionar/editar/excluir. Mostra soma total no header

## Novas Tabelas (Supabase)
- `depositos_recursais`: id, processo_id, data_pagamento, titulo, valor, observacoes, criado_por
- `custas_processuais`: id, processo_id, data_pagamento, descricao, valor, observacoes, criado_por

## Componentes Criados
- `src/hooks/useDepositosCustas.ts` - Hook para gerenciar depósitos e custas
- `src/components/processos/PendenciasProcessoCard.tsx` - Card de pendências
- `src/components/processos/DepositosRecursaisCard.tsx` - Card de depósitos recursais
- `src/components/processos/CustasProcessuaisCard.tsx` - Card de custas processuais
