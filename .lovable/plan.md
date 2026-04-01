

# Diagnóstico e Correção: DJEN Termos Pro executando parcialmente

## Problema Identificado

O motor DJEN Termos Pro hoje processou apenas **2 de 164 monitoramentos** (65 publicações vs. 600-800 na semana passada). A causa raiz:

1. **O INSERT na tabela `execucoes_agendadas` está falhando silenciosamente** -- zero registros `djen_pro` existem na tabela, apesar do código tentar inserir
2. Sem registro no banco, a trava "já executou hoje" do scheduler não funciona
3. O scheduler dispara execuções repetidas, que sofrem rate limiting (429) da API PJE Comunica
4. Resultado: apenas os primeiros monitoramentos conseguem dados antes do bloqueio

## Causa Raiz Técnica

O `executarLoop()` faz o INSERT com `.select('id').single()`, mas o erro é capturado em um `try/catch` silencioso (só faz `console.warn`). O problema provável: o campo `status` do INSERT usa valor `'executando'` mas pode haver uma constraint ou o RLS está bloqueando de forma inesperada. Porém, a policy de INSERT diz `with_check: true` (permite tudo para authenticated), então o problema pode ser no `.single()` retornando erro quando o INSERT funciona mas a resposta não vem como esperado.

## Ações

### 1. Corrigir o INSERT na `execucoes_agendadas` (useDjenTermosProEngine.ts)
- Remover `.single()` e usar `.select('id')` com acesso ao array `data[0]`
- Adicionar log explícito do erro se o INSERT falhar
- Adicionar campos obrigatórios que podem estar faltando (ex: `job_name`)

### 2. Adicionar fallback robusto para a trava diária (useDjenTermosProScheduler.ts)
- Se o INSERT no banco falhar, usar localStorage como fallback para evitar re-execuções
- Registrar `lastRunDate` ANTES de chamar `executarDjenTermosPro`, não depois

### 3. Logar erros 429 de forma mais visível (pjeComunicaClient.ts)
- Quando ocorrerem múltiplos 429s consecutivos, emitir um aviso no progresso para o usuário saber que está sendo throttled

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useDjenTermosProEngine.ts` | Fix INSERT (remover `.single()`, adicionar `job_name`, melhorar error logging) |
| `src/hooks/useDjenTermosProScheduler.ts` | Fallback localStorage antes de executar, prevenir re-execução mesmo sem DB |

## Resultado Esperado

Após a correção:
- O registro `djen_pro` será gravado corretamente na `execucoes_agendadas`
- O indicador flutuante mostrará progresso real
- A trava diária impedirá execuções duplicadas
- O motor processará todos os 164 monitoramentos sem interrupção por 429

