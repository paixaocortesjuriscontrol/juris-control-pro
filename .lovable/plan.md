# Desfazer última ação — Painel de Controle e Análise DJEN

Objetivo: em cada uma das duas telas, um botão "Desfazer último" que reverte **somente a última ação feita pelo usuário naquela sessão da tela** (marcação como lida individual, "Marcar todas", descarte em lote, etc.).

## Painel de Controle (Mensagens recebidas)

Hoje o painel marca mensagens como lidas (clique no card e botão "Marcar todas") e não existe forma de reverter.

- Guardar em memória a última marcação feita: quais IDs de alerta foram marcados e o rótulo ("Marcar todas (20)" ou "Marcar 1 mensagem como lida").
- Novo botão **Desfazer último** ao lado de "Marcar todas", ativo apenas quando existe uma ação na sessão. Mostra no título qual ação será revertida.
- Ao desfazer: remove só os registros de leitura criados por aquela ação (não mexe em mensagens que já estavam lidas antes), atualiza a lista, o contador "não lidas" e o badge do menu.
- O toast de sucesso de "Marcar todas" também ganha a ação rápida "Desfazer".
- Depois de desfazer, o botão fica indisponível até que uma nova ação seja feita (apenas a última ação é reversível).

## Análise DJEN

A tela já tem uma pilha de sessão que cobre: marcar selecionadas como lidas, "Salvar e ler", descarte das selecionadas e item criado a partir da publicação. Faltam ações que hoje não entram nessa pilha:

- Marcar como lida individual (clique/checkbox de leitura numa publicação da lista).
- Descarte individual de uma publicação.
- "Descartar duplicadas" (lote) e o descarte por lote do topo da tela — passam a registrar o lote como última ação, desfeito via reversão do lote.
- O botão "Desfazer último" passa a exibir o rótulo da última ação (ex.: "Desfazer: Marcar 12 publicação(ões) como lida(s)") e a mensagem de confirmação descreve exatamente o efeito.
- Se o filtro "Não lidas" estiver ativo, ao desfazer uma leitura as publicações reaparecem imediatamente na lista (atualização otimista, sem recarregar a tela).

Em ambas as telas a pilha é por sessão da tela (não persiste após recarregar a página) e sempre só a última ação fica disponível para desfazer.

## Detalhes técnicos

- `src/components/notificacoes/MinhasMensagensRecebidas.tsx`: estado `ultimaAcaoLeitura` ({ ids, label }); `marcarLida` passa a devolver os IDs efetivamente inseridos; `desfazerUltimaLeitura` faz `delete` em `alertas_recebidos_leituras` por `user_id` + `alerta_id in (...)` e invalida `minhas-mensagens-leituras`, `mensagens-nao-lidas` e `alertas-recebidos`.
- `src/pages/AnaliseDjen.tsx`: novos tipos na união `AcaoSessao` (`descarte_lote` com `lote_id`), chamadas de `registrarAcaoSessao` nos handlers de leitura individual, descarte individual e descarte de duplicadas; `desfazerUltimaAcaoSessao` trata o novo tipo chamando a RPC `desfazer_descarte_lote`.
- Sem mudanças de banco: as RPCs `desfazer_descarte_individual` / `desfazer_descarte_lote` e a tabela `alertas_recebidos_leituras` já suportam a reversão.
- Bump de versão em `src/constants/version.ts`.
