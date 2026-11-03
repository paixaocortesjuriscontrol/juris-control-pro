# Corrigir títulos e responsáveis das tarefas migradas do Projuris (sem modelo)

## O que foi verificado
- A tarefa da foto ("DISP 13/10 - PUB 14/10 - PF 05/11") veio do Projuris em 22/10, **sem modelo de tarefa**, **sem descrição** e **sem processo**. O texto que no Projuris ficava na descrição foi gravado como título.
- A correção anterior ("Corrigir títulos pelo modelo") só alcança tarefas que têm modelo. Por isso estas ficaram de fora.
- Tarefas migradas do Projuris hoje:
  - 66.228 com modelo (já corrigíveis pela correção anterior);
  - **5.964 sem modelo e sem descrição** — o caso da foto (4.258 sem processo, 1.706 com processo);
  - 1.935 sem modelo, com descrição, sem processo.

## O que vou fazer
1. **Nova correção "Tarefas sem modelo"** no cartão "Corrigir títulos" da Migração Projuris:
   - Lê do backup (`tarefaevento.csv` + `tarefatipo.csv`) o tipo de cada tarefa pelo código Projuris já registrado.
   - Título passa a ser o nome do tipo (ex.: "Manifestação", "Prazo"); o texto atual vai para a **descrição/observações**, sem perder nada.
   - Liga a tarefa ao modelo correspondente, quando existir.
   - Tarefas que não estão no backup: título vira o tipo já gravado na tarefa (PRAZO, MANIFESTAÇÃO…) e o texto vai para a descrição. Mostra a contagem e um CSV com essas tarefas.
   - Mesmo cuidado de antes: lotes pequenos, sem disparar e-mails.
2. **Responsáveis errados ("tarefas não são minhas, vieram porque eu criei")**: conferir no backup quem era o responsável de fato (tabela de responsáveis da tarefa no Projuris) e, se a importação usou quem criou, oferecer na mesma correção a troca para o responsável real. Primeiro confirmo com dados antes de alterar.
3. **Tarefas sem processo**: muitas ficaram soltas porque os processos ainda não foram todos cadastrados. Incluir um botão "Religar tarefas a processos" que, depois que novos processos forem cadastrados, tenta ligar de novo pelo vínculo do backup.

## Detalhes técnicos
- Chave: `migracoes_projuris_itens` (tipo `tarefa`, `chave_externa` = cdtarefa) → `tarefaevento.cdtarefatipo` → `tarefatipo` → `modelos_titulo_coordenacao.padroes.projuris_cd`.
- Atualização via RPC admin (SECURITY INVOKER) em lotes com `app.sem_notificacao`, reaproveitando o padrão de `corrigir_titulos_por_modelo_projuris`.
- Para responsáveis: verificar coluna/tabela de responsável no backup antes de implementar; sem dados confiáveis, nada muda.
- Testes para a regra de título (tipo como título, texto antigo preservado na descrição).
