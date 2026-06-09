## Objetivo
Garantir que registros já arquivados em `dados_benner_arquivados` não interfiram quando a advogada altera/salva a linha ativa equivalente. **Não** vou limpar duplicatas existentes nem criar UNIQUE no banco.

## O problema real
Quando uma linha de `dados_benner` é arquivada, ela é removida da tabela principal e copiada para `dados_benner_arquivados`. Mas:

1. Telas que já estavam abertas continuam segurando o `id` antigo (arquivado).
2. Ao salvar, o `update().eq("id", id_arquivado)` não acha nada — Supabase não retorna erro, retorna 0 linhas.
3. A tela exibe "Salvo com sucesso" e a advogada perde a alteração silenciosamente.

## O que vou fazer

1. **Detectar id arquivado no save e redirecionar para a linha ativa**
   - Em `useDistribuicoesTst.saveDado`, `useDadosBenner.saveDado` e `DadosBennerDistribuicaoTab.handleSave`:
     - Tentar `update` na linha pelo `id`.
     - Se retornar 0 linhas, buscar automaticamente em `dados_benner` a linha ativa equivalente pelo mesmo `processo + dossie`.
     - Se encontrar, refazer o `update` nessa linha ativa, mantendo as alterações da advogada.
     - Avisar com toast informativo: "A linha antiga foi arquivada; alterações aplicadas ao registro ativo".
     - Só mostrar erro se realmente não existir nenhuma linha ativa para o processo/dossie.

2. **Avisar a aba aberta que o id mudou**
   - Após o redirecionamento, retornar o novo `id` para o container atualizar o estado, evitando que a próxima edição volte a apontar para o id arquivado.

3. **Não tocar em**
   - Estrutura do banco (sem UNIQUE, sem migrations).
   - Dados existentes (nenhuma duplicata será apagada/fundida).
   - Lógica de quem pode arquivar / quando arquivar.

## Resultado esperado
A advogada pode continuar editando processos normalmente; se a linha que ela tem aberta tiver sido arquivada por outro fluxo, o sistema migra a edição para a linha ativa sem perda silenciosa e sem precisar recarregar a página.