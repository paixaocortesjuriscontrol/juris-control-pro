

# Atualizar Tipo de Recurso via API DataJud

## Objetivo
Adicionar botão "Atualizar Tipo Recurso" na tela Dados Benner que consulta a API DataJud para preencher automaticamente o campo `tipo_recurso` dos registros vazios. Registros já preenchidos não serão alterados. Na tabela, os tipos preenchidos pela API terão célula com fundo amarelo.

## Arquitetura
Reutiliza o padrão exato do "Verificar Trânsito em Julgado": Edge Function consulta DataJud, frontend processa em lotes com progresso e cancelamento.

## Alterações

### 1. Nova Edge Function: `supabase/functions/atualizar-tipo-recurso-datajud/index.ts`
- Recebe `{ processos: string[], ids_benner: string[] }`
- Para cada processo, consulta DataJud (TRT de origem + TST) usando a mesma lógica de endpoints do `verificar-transito-julgado`
- Extrai `classe.nome` do hit (prioriza TST sobre TRT)
- Atualiza `dados_benner.tipo_recurso` via ID do registro
- Retorna `{ ok, resultados: [{ numero, tipo_recurso, erro }] }`

### 2. Frontend: `src/pages/DadosBenner.tsx`
- Novo botão "Atualizar Tipo Recurso" ao lado do "Verificar Trânsito"
- Handler `handleAtualizarTipoRecurso`:
  - Busca registros filtrados onde `tipo_recurso` é nulo/vazio (query com `.or('tipo_recurso.is.null,tipo_recurso.eq.')`)
  - Processa em batches de 5 no frontend, 2 na Edge Function
  - Dialog de progresso com barra, resultados e cancelamento (mesmo padrão do trânsito)
- Na coluna "Tipo Recurso" da tabela, exibir fundo amarelo (`bg-yellow-100`) quando o campo `tipo_recurso_auto` for true (campo marcado pela Edge Function ao preencher via API)

### 3. Migração de banco
- Adicionar coluna `tipo_recurso_auto boolean default false` na tabela `dados_benner` para marcar registros preenchidos pela API (permite estilizar com amarelo na tabela)

## Fluxo
1. Usuário clica "Atualizar Tipo Recurso"
2. Frontend busca todos os registros filtrados com `tipo_recurso` vazio
3. Envia em lotes de 5 para a Edge Function
4. Edge Function consulta DataJud, extrai `classe.nome`, atualiza no banco e marca `tipo_recurso_auto = true`
5. Dialog mostra progresso e resultados
6. Na tabela, células com `tipo_recurso_auto = true` aparecem com fundo amarelo

