---
name: Sem criação automática de tarefas
description: Gatilhos de criação automática de tarefa por intimação/audiência foram removidos do banco e não devem voltar
type: constraint
---
Proibido criar tarefas automaticamente a partir de intimações ou audiências detectadas.

Removidos do banco (migração 2026-09-01):
- trigger `trigger_criar_tarefa_intimacao` em `intimacoes_detectadas`
- trigger `trigger_criar_tarefa_audiencia` em `audiencias_detectadas`
- funções `criar_tarefa_automatica_intimacao()` e `criar_tarefa_automatica_audiencia()`

Mantidos: `trg_bloquear_intimacao_automatica`, `trg_bloquear_audiencia_automatica`, `trigger_prevent_duplicate_tarefas` (travas de proteção).

**Why:** o escritório exige que toda tarefa/prazo seja criada por uma pessoa. O card [PRAZO FATAL] no calendário é virtual (lido de `processos.data_fatal`), não grava nada.
