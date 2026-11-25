# Painel de Controle lento para a Geovana Farias (Santander Cível)

## O que já confirmei
- A Geovana já está na versão nova. Mesmo assim, outras pessoas ainda abrem o sistema na versão antiga: a busca lenta de comentários antiga continua sendo chamada (cerca de 80 vezes nos últimos minutos).
- Em novembro, a Santander Cível tem **5.656 tarefas**. Com as 3.301 devolvidas hoje, esse número mais que dobrou. O Painel em Escritório carrega o mês inteiro da coordenação e, para cada tarefa, busca ícones de comentário, cobrança, atividades, workflow, modelo e pessoas.
- A busca principal da agenda responde rápido no servidor (cerca de 8 ms). O peso parece vir da quantidade de buscas extras por tarefa e da montagem da tela, mas **isso ainda não está confirmado**.

## O que vou fazer
1. **Medir primeiro.** Abro o Painel no navegador de teste, em Escritório, filtrado pela Santander Cível em novembro, na visão Lista (a mesma da foto). Registro cada busca e quanto tempo leva até a lista aparecer.
2. **Corrigir só o que a medição apontar**, por exemplo:
   - juntar em uma busca no servidor as marcas que hoje são pedidas em muitos lotes (cobranças, atividades, workflow, pessoas), como já foi feito com os comentários;
   - mostrar a lista assim que as tarefas chegarem e completar os ícones depois, para a tela não ficar em branco esperando tudo.
3. Medir de novo e informar o tempo de antes e de depois.

Nenhuma regra de quem vê o quê muda.

## Detalhes técnicos
- Playwright com a sessão da conta, capturando network/timings de `get_agenda_escritorio`, `resumo_comentarios_itens`, `item_cobrancas`, `useItensComAtividades`, `useItensDeWorkflow`, `useModeloTarefaItens`, `tarefa_responsaveis/envolvidos`.
- Qualquer RPC nova: SECURITY DEFINER com checagem de acesso por item (mesmo padrão de `resumo_comentarios_itens`) e GRANT só para `authenticated`.
