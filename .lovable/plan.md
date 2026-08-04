# Atualizar os cards logo após a distribuição

## Problema

Depois de executar a distribuição automática (ou delegação), os cartões "Por responsável" continuam com os números antigos até recarregar a página. A rotina de atualização da tela recarrega a lista, os totalizadores e as abas, mas não recarrega os contadores por advogado.

## O que será feito

- Incluir o recarregamento dos contadores por responsável na rotina geral de atualização da tela de Distribuição TST, para que qualquer ação (distribuir, delegar, atualizar manualmente) já traga os números novos.
- Fazer o diálogo de distribuição aguardar essa atualização antes de fechar, garantindo que ao voltar para a lista os cartões já estejam com os valores corretos (sem piscar valores antigos).

## Detalhes técnicos

- `src/pages/DistribuicaoTst.tsx`: adicionar `refetchResponsavelCounts()` (e o refetch da contagem "pronto sem pendência", se aplicável) dentro de `handleRefresh`, transformando-o em função assíncrona que aguarda os refetches; os `onSuccess` de `DistribuirAutomaticoDialog` e `DelegarProcessosDialog` já chamam `handleRefresh` com `await`.
- Nenhuma alteração de banco de dados.
