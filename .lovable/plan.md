# Carga de pedidos por dossiê: evitar apagar matérias já cadastradas

## Resposta à dúvida

Sim, pode ter apagado. Hoje, 16/09/2026 às 12:27 (BRT), entrou uma carga com 707 dossiês e 9.316 pedidos. A importação, por regra atual, **apaga todos os pedidos dos dossiês que estão na planilha e regrava só o que veio nela**. Se a planilha de hoje trouxe menos pedidos para um dossiê já cadastrado, os que faltavam foram removidos — e não existe cópia do que havia antes, porque a exclusão não guarda histórico.

Cargas registradas:
- 16/09/2026 12:27 — 707 dossiês / 9.316 pedidos
- 04/09/2026 18:32 — 6.829 dossiês / 79.614 pedidos
- 04/09/2026 18:19 — 787 dossiês / 10.042 pedidos
- 02/09/2026 18:06 — 363 dossiês / 4.871 pedidos

Impacto visível hoje: das 831 fichas ligadas aos 707 dossiês, apenas 2 estão com pendência — ou seja, o estrago aparente é pequeno, mas não é possível provar que nada foi perdido sem um histórico.

## O que fazer

1. **Guardar o que é apagado.** Antes de regravar, a importação passa a copiar os pedidos atuais dos dossiês da planilha para um histórico, com data, nome do arquivo e quem importou. Assim qualquer perda futura é reversível.
2. **Mostrar as diferenças antes de gravar.** A tela passa a exibir, por dossiê, quantos pedidos serão mantidos, quantos são novos e **quais serão removidos**, com botão para confirmar ou cancelar.
3. **Modo somente somar (padrão).** Nova opção na importação:
   - *Somar aos existentes* (padrão): nada é apagado, só acrescenta o que falta.
   - *Substituir* (como hoje): apaga e regrava, mas com histórico e confirmação da lista de removidos.
4. **Relatório em Excel** do resultado da carga: abas Resumo, Novos, Removidos e Mantidos.
5. **Restaurar a carga de hoje**, se você quiser: com a planilha usada em 16/09 e a anterior em mãos, recadastro os pedidos que ficaram de fora sem tocar nos atuais.

## Detalhes técnicos

- Nova tabela `pedidos_por_dossie_historico` (dossie, pedido, pedido_normalizado, origem_anterior, removido_em, removido_por, arquivo_carga) com RLS de leitura para usuários autenticados e escrita via a própria importação.
- `src/components/distribuicao-tst/PedidosPorDossieDialog.tsx`: antes do `delete().in("dossie", part)`, `select` dos registros atuais desses dossiês, `insert` no histórico, cálculo do diff (mantidos / novos / removidos) e etapa de confirmação; no modo *somar*, troca o delete+insert por insert apenas dos normalizados ausentes.
- Reset/recarga dos caches (`resetPedidosPorDossie`, `ensurePedidosPorDossie`) e invalidação das queries já existentes seguem como estão.
- Texto de ajuda em `src/pages/admin-tst/PedidosPorDossie.tsx` atualizado para o novo comportamento.
