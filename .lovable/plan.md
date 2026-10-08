# Análise DJEN: processos cadastrados aparecendo com "Importar"

## O que foi conferido

Procede. Dos 6 processos dos prints, 5 estão cadastrados desde 02/08/2026:
0000237-50.2025.5.10.0003, 0001541-15.2025.5.18.0051, 0001521-48.2025.5.10.0018, 0000822-43.2023.5.10.0013 e 0000344-21.2026.5.10.0016. Mesmo assim, a Análise DJEN mostra o botão **Importar** para eles. Só o 0002296-83.2026.5.10.0000 (precatório) realmente não está cadastrado.

As publicações chegam sem o vínculo com o processo, então a tela procura o processo pelo número na hora de montar a lista. A permissão de leitura não é o problema: todo usuário ativo pode ver todos os processos.

## Causa provável (confirmar no primeiro passo)

1. **Lista grande demais:** a tela manda todos os números da página numa única consulta, em três formatos cada um. Com muitas publicações, como na lista da Dra. Janaina, a consulta passa do limite de tamanho e falha sem aviso. Aí nenhum processo é reconhecido, e por isso o problema acontece "em alguns casos".
2. **Só busca para parte do que aparece na lista:** a procura só é feita para as publicações de termo. Ficam de fora as pautas do DEJT (print 1, fonte "dejt-pdf") e as que vêm do Kurier ou do PJe direto.

## O que será feito

- Dividir a procura em blocos pequenos, de cerca de 100 números cada, nos dois caminhos que montam a lista.
- Procurar o processo para todas as publicações sem vínculo, de qualquer origem.
- Comparar sempre só pelos números, sem pontos e traços, como já é feito hoje.
- Não alterar nada no banco de dados.

## Como conferir

Abrir a Análise DJEN como a Dra. Janaina, com o período de 01/10 a 08/10. Os 5 processos acima devem mostrar "Processo Cadastrado" com atalho para a ficha, e não mais o botão Importar.

## Detalhes técnicos

- `src/hooks/usePublicacoesDjenUnificadas.ts`: em `resolveProcessoIdsPromise` (~l.737), trocar o filtro `tipo_origem === 'termo'` por `!p.processo_id && p.processo_numero` e fazer `.in('numero', chunk)` em lotes de 100 com `Promise.all`, registrando o erro no console. Aplicar o mesmo lote no fallback (~l.987).
- Conferir se `usePublicacoesDjenServidorUnificadas.ts` tem o mesmo padrão e aplicar a mesma correção.
- Antes da correção, confirmar a falha da consulta (erro 414/400) com uma página real.
