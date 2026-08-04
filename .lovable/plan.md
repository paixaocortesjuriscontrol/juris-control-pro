# Distribuição automática: números por advogado não atualizam na tela

## O que a verificação no banco mostrou

- A distribuição **funcionou**: hoje a Dra. Camila (`6db66cfd…`) está com **0 vínculos** na tabela de responsáveis da Distribuição TST, e a Dra. Tatiana Hollanda (`cd8a5000…`) está com **283 vínculos**.
- As permissões e políticas de exclusão/inserção dos vínculos estão corretas, então a opção "Substituir responsáveis existentes" realmente apagou os vínculos antigos.
- O problema é apenas de **atualização da tela**: os cartões de contagem por advogado são carregados por um hook próprio (`useResponsaveisCounts`), e a rotina de atualização executada após a distribuição (`handleRefresh`) recarrega a lista, as abas e os totalizadores gerais, mas **não** recarrega esses cartões. Por isso Camila continuava aparecendo com 263.

## Correção

1. Em `src/pages/DistribuicaoTst.tsx`, incluir o recarregamento dos cartões por responsável (`refetchResponsavelCounts`) dentro de `handleRefresh`, para que qualquer ação de refresh — distribuição automática, delegar, distribuir selecionados, botão atualizar — traga os números novos.
2. Garantir que o `onSuccess` dos diálogos de distribuição/delegação aguarde esse recarregamento antes de fechar, evitando exibir número antigo por um instante.
3. Sem mudança de banco de dados nem de lógica de distribuição — o comportamento de substituição continua igual.

## Resultado esperado

Depois de distribuir da Dra. Camila para a Dra. Tatiana, os cartões passam a mostrar imediatamente Camila reduzida (ou zerada) e Tatiana com o total recebido, sem precisar recarregar a página.
