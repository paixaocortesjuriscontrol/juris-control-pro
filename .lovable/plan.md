# Judit — Consulta sempre atual (sem cache)

## Decisão
Cada clique no botão Judit (Distribuição TST, Processos e Casos, etc.) passa a disparar uma **consulta nova na Judit com `cache_ttl_in_days: 0` (crawler/dados frescos)**. O `judit_logs` deixa de ser usado como cache de leitura e vira **somente log de auditoria/consumo** (tela Consumo Judit).

## O que muda

### 1. Edge Function `buscar-judit`
- Remover a etapa de leitura de cache local (`judit_logs` com `is_tst_rd` / validade de 3 dias) que encerrava a consulta cedo.
- Toda chamada envia `cache_ttl_in_days: 0` à Judit (equivalente ao "Forçar atualização" atual).
- Manter a gravação no `judit_logs` apenas para auditoria (latência, custo, instância retornada).
- Manter retentativa dirigida à instância TST e o alerta quando a Judit ainda não indexou a instância TST.

### 2. Frontend
- `DistribuicaoTstForm.tsx` e demais telas com botão Judit: remover mensagens/lógica de "resultado do cache"; exibir "consultando dados atualizados na Judit..." durante o polling.
- Botão "Forçar atualização" passa a ser redundante — pode ser mantido como alias ou removido (decisão: remover, já que todo clique agora é forçado).

## Impacto de custo (importante)
- **Cada clique vira uma chamada paga de crawler na Judit.** Hoje, cliques repetidos no mesmo processo em até 3 dias saem de graça (cache). Com a mudança, todos são cobrados.
- O consumo passa a ser integralmente auditável na tela **Consumo Judit** (cliques, latência, custo estimado por usuário).

## Verificação
- Clicar no Judit em um processo já consultado antes: resposta deve vir do crawler (latência ~8–30s) e não do log.
- Conferir `judit_logs`: cada clique gera um registro novo com `com_anexos: false` e instância correta.
- Tela Consumo Judit refletindo o volume real de consultas.
