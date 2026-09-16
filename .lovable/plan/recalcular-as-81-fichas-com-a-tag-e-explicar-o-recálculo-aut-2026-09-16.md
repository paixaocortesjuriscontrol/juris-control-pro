# Recalcular as 81 fichas com a tag e explicar o recálculo automático

## Por que não recalcula sozinho hoje

O marcador de pendência é gravado no banco e só muda quando alguém aciona "Verificar Pendências" na tela, ou quando a própria ficha é salva. Não existe rotina automática que reprocesse a base inteira. Isso foi feito para não sobrescrever milhares de registros a cada mudança de regra, mas tem o efeito colateral que você viu: fichas marcadas com uma regra antiga continuam vermelhas até serem verificadas de novo.

## O que será feito

1. **Recalcular as 81 fichas com a tag "PEDIDOS CADASTRADOS DOSSIÊ JÁ ENVIADOS"** que hoje estão marcadas como pendentes desde 05/09/2026, aplicando a regra atual:
   - Terceiro como única parte recorrente: sem pendência de matérias.
   - Dossiê sem nenhum pedido cadastrado: continua pendente.
   - Dossiê com pedidos cadastrados: pendente apenas se a parte recorrente não tiver nenhuma matéria que conste na lista do dossiê.
2. **Atualizar o marcador e a data da verificação** de cada ficha conforme o resultado, e registrar a alteração na auditoria.
3. **Manter as pendências reais** de campos obrigatórios e tipos de recurso fora da lista oficial, sem mexer nelas.

## Recálculo automático, para não repetir o problema

Ao entrar na tela de Distribuição TST, o sistema passa a reverificar em segundo plano as fichas prontas cuja última verificação é anterior à data da regra atual, em pequenos lotes, sem travar a tela. Assim, fichas com marcação antiga se corrigem sozinhas conforme são exibidas, e a coluna Pendências deixa de divergir dos cards.

## Validação

- Nenhuma das 81 fichas deve continuar vermelha sem motivo visível na coluna Pendências.
- Rodar "Verificar Pendências" no mesmo grupo depois e confirmar que nenhum número muda.
- Conferir que a soma de "Pronto sem pendência" e "Pronto com pendência" fecha com "Prontos" por responsável.
