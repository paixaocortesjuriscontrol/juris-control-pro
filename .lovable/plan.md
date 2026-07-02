## Objetivo

Mover a execução dos monitoramentos **DJEN Kurier** e **DJEN Pautas (DEJT)** do navegador para o servidor (VPS/edge), **mantendo a gravação nas tabelas oficiais do Browser** — nunca em `publicacoes_djen_servidor`. Assim os cards, dedup, comparador e agenda continuam funcionando como hoje, só o motor de coleta muda de lugar.

## Regras não-negociáveis

1. Isolamento estrito: os motores de Kurier e Pautas gravam **apenas** em `publicacoes_djen` (e nas tabelas auxiliares Kurier já existentes: `kurier_publicacoes_raw`, `kurier_execucoes`). Nunca escrevem em `publicacoes_djen_servidor`.
2. Chaves de deduplicação **idênticas** às atuais do Browser: `id_djen`/`hash_conteudo` + `coordenacao_id`, com `tipo_publicacao='pauta'` para pautas e `origem='kurier'` para Kurier. Zero flag nova de origem.
3. Agenda existente do Browser é reaproveitada: `configuracoes_monitoramento` com `tipo='kurier'` e `tipo='djet_pautas'` (horários, dias, `ultima_execucao`) — sem tabelas paralelas.
4. As telas de execução manual client-side no navegador são **removidas**; o botão passa a disparar a rota do servidor.

## Arquitetura (rotas dedicadas por tipo)

### DJEN Pautas
A edge function `executar-djet-pautas-agendado` já suporta `persistMode='browser'` (grava em `publicacoes_djen`, `tipo_publicacao='pauta'`). Vamos:

- Garantir que o cron pg_cron chame essa função no horário BRT configurado em `configuracoes_monitoramento` (`tipo='djet_pautas'`), com `persistMode='browser'` fixo.
- Expor um endpoint manual (mesmo edge) para o botão "Executar agora" no `MonitoramentoDjetPautasCard.tsx`, com o mesmo `persistMode='browser'`.
- Remover o motor client-side `useDjetPautasParalelaEngine.ts` e o hook `useDjetPautasParalela.ts` da tela; card passa a mostrar apenas o progresso vindo de `execucoes_agendadas` (`tipo='djet_pautas'`).

### DJEN Kurier
Criar uma nova edge function `executar-kurier-agendado` (espelhando o padrão de `executar-djet-pautas-agendado`):

- Lê `configuracoes_monitoramento` (`tipo='kurier'`, horários/dias/base_url), valida janela BRT e último disparo.
- Enumera credenciais Kurier ativas (`kurier_credenciais` com `kurier_credencial_coordenacoes`) e chama, com concorrência 3, a edge function existente `kurier-consultar-publicacoes` para cada credencial (que já persiste em `publicacoes_djen` com `origem='kurier'` e alimenta `kurier_publicacoes_raw`/`kurier_execucoes`).
- Grava progresso incremental em `execucoes_agendadas` (`tipo='kurier'`) para as telas lerem em tempo real (mesmo padrão que Pautas usa hoje).
- Suporta execução manual (`{ manual: true, coordenacaoIds?: [] }`) para o botão da tela.

### Agendamento (herda do Browser)
- Não criamos tabela nova. Cron `pg_cron` a cada 5 min invoca ambas edges via `pg_net` (SQL via ferramenta insert; contém anon key, por isso não usa migration).
- Cada edge decide se roda: janela BRT dos horários salvos em `horarios_execucao`, dia da semana permitido, `ultima_execucao` do dia diferente.

### Front-end
Trocar totalmente pelo Servidor:

- `MonitoramentoTermosKurierCard.tsx` e `MonitoramentoDjetPautasCard.tsx`: botão "Executar agora" passa a `supabase.functions.invoke('executar-kurier-agendado' | 'executar-djet-pautas-agendado', { manual: true })`.
- Painel de progresso lê `execucoes_agendadas` (subscribe realtime) em vez do singleton em memória.
- Remover `useDjenTermosKurier.ts` + `useDjenTermosKurierEngine.ts` + `useDjetPautasParalela.ts` + `useDjetPautasParalelaEngine.ts` (client-side). Os schedulers `useDjenTermosKurierScheduler.ts` e `useDjetPautasParalelaScheduler.ts` viram apenas leitura/edição do CRUD de horário em `configuracoes_monitoramento` (sem timer no browser).

## Passos de implementação

1. Criar `supabase/functions/executar-kurier-agendado/index.ts` reutilizando o esqueleto de `executar-djet-pautas-agendado` (persistMode fixo browser, itera credenciais Kurier).
2. Ajustar `executar-djet-pautas-agendado` para tratar `persistMode` default como `browser` quando invocada pelo cron/manual (sem `execucaoServidorId`).
3. `insert` SQL (usa anon key do projeto, não migration): `pg_cron` a cada 5 min para as duas edges.
4. Refatorar os dois cards (`MonitoramentoTermosKurierCard`, `MonitoramentoDjetPautasCard`) para disparar edge e ler progresso de `execucoes_agendadas`.
5. Remover hooks e engines client-side listados acima.
6. Simplificar schedulers para persistir apenas configuração (sem `setInterval`).
7. Smoke test: dispara manual em coord piloto (Bruna) → confere `publicacoes_djen` (`origem='kurier'` e `tipo_publicacao='pauta'`) sem qualquer linha em `publicacoes_djen_servidor`.

## Fora de escopo

- Nenhuma alteração no comparador, RPCs, telas de análise ou tabelas de dedup.
- DJEN Termos Browser continua como está (já foi alinhado em turnos anteriores).