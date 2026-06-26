## Problema

A tela **Análise DJEN (Local)** não exibe o card "Execuções do dia" porque a tabela de junção `publicacoes_djen_execucoes` foi criada **sem foreign keys**. O hook `useExecucoesDoDiaLocal` faz um embed PostgREST (`publicacao:publicacoes_djen!inner(...)`) que devolve erro `PGRST200`:

> Could not find a relationship between 'publicacoes_djen_execucoes' and 'publicacoes_djen'…

Confirmado por chamada direta ao REST. Sem FKs o hook nunca retorna linhas, então o card "se esconde" silenciosamente (componente só renderiza com `execs.length >= 2`). Os dados existem (967 vínculos hoje em 3 execuções), só falta o relacionamento declarado.

Por contraste, o equivalente do servidor (`publicacoes_djen_servidor_execucoes`) tem as FKs corretas e por isso o card aparece lá.

## Correção

Migration única adicionando as duas FKs faltantes (mesmo padrão da versão servidor):

```sql
ALTER TABLE public.publicacoes_djen_execucoes
  ADD CONSTRAINT publicacoes_djen_execucoes_publicacao_fk
  FOREIGN KEY (publicacao_id) REFERENCES public.publicacoes_djen(id) ON DELETE CASCADE;

ALTER TABLE public.publicacoes_djen_execucoes
  ADD CONSTRAINT publicacoes_djen_execucoes_execucao_fk
  FOREIGN KEY (execucao_id) REFERENCES public.execucoes_agendadas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pde_execucao_id ON public.publicacoes_djen_execucoes(execucao_id);
CREATE INDEX IF NOT EXISTS idx_pde_publicacao_id ON public.publicacoes_djen_execucoes(publicacao_id);
```

Após a migration o PostgREST passa a reconhecer o embed e o `useExecucoesDoDiaLocal` devolve as execuções do dia com `totalVistas` e `novasCount`, fazendo o `ExecucoesDoDiaLocalCard` aparecer na Análise DJEN exatamente como na versão servidor (precisa ter o filtro **Data de Disponibilização** preenchido e 2+ execuções do dia, mesma regra da tela servidor).

## Sem alterações de UI

Nenhuma mudança em React — o card e o hook já estão prontos e corretos; só faltava o relacionamento no banco.
