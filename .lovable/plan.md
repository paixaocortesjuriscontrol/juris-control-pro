# Progresso visível no cadastro de Acompanhamento Especial

## Objetivo
Mostrar, dentro do painel lateral, em qual etapa está o cadastro para que o usuário acompanhe todo o processamento sem depender apenas do ícone de carregamento.

## Implementação
- Adicionar um quadro de progresso no cadastro individual com etapas claras:
  1. Procurando o processo na base
  2. Consultando e preenchendo dados pela Judit, quando o processo for novo
  3. Ativando o Acompanhamento Especial
  4. Atualizando a tela
  5. Concluído ou erro
- Exibir percentual, etapa atual e número do processo durante o processamento.
- Manter o progresso visível ao concluir, com confirmação do resultado, e reiniciá-lo ao começar outro cadastro.
- Melhorar o lote para mostrar, além do total concluído, qual processo está sendo tratado e a etapa atual dele: busca, Judit, ativação ou conclusão.
- Mostrar contadores de sucessos e erros enquanto o lote avança.
- Impedir fechamento acidental do painel e nova submissão durante o processamento.

## Escopo técnico
- Alterar apenas o painel de cadastro de Acompanhamento Especial.
- Reaproveitar o componente visual de progresso já usado no projeto.
- Não alterar tabelas, permissões ou regras do Supabase.
- Validar a compilação e o comportamento visual do painel.
