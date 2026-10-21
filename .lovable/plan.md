# Explicação técnica para o suporte Projuris

## O que será entregue
Um documento em PDF, com uma versão em texto para colar no e-mail, explicando por que o backup enviado não permite ligar tarefas, comentários e anexos aos processos. O documento também lista exatamente o que precisamos receber.

## Conteúdo do documento
1. **Resumo**
   - O backup tem os dados, mas não traz as tabelas que dizem a que processo pertence cada tarefa, comentário ou anexo.
2. **O que recebemos e conseguimos ligar**
   - Cerca de 21.730 processos, 122.240 andamentos, 98.260 tarefas, 36.376 anexos e 135 mil comentários.
   - Processo e número CNJ: ligação pelo `processonumero`.
   - Andamentos e processos: ligação pelo `andamentovinculomodulo` (módulo 3). Esse exemplo prova que o padrão de "vínculo por módulo" funciona quando a tabela vem no backup.
3. **O que não dá para ligar e por quê**
   - Tarefas: a tabela `tarefaevento` não tem a coluna do processo. Por caminhos indiretos (fluxos e intimações), conseguimos ligar só cerca de 40 mil das 98 mil tarefas.
   - Comentários (módulo 32): não há nenhuma tabela que diga a qual tarefa ou processo cada comentário pertence.
   - Anexos (módulo 35): o arquivo complementar que vocês enviaram tem 10.338 itens. Só 6 deles estão ligados a tarefas, e nenhum é comentário. Ele cobre apenas o período de 13/05/2026 a 01/10/2026.
   - Responsáveis: faltam as tabelas de ligação entre usuário e tarefa e entre usuário e processo.
4. **O que pedimos, item por item**
   - `tarefavinculomodulo`
   - `arquivovinculomodulo`
   - `comentariovinculomodulo` (ou a tabela equivalente)
   - `retarefaeventousuario`
   - `reprocessousuario`
   - `marcadorvinculomodulo`
   - Como alternativa: o Relatório de Atividades completo, sem filtros, com as colunas Identificador e Processo Vinculado.
5. **Como o suporte pode conferir**
   - Um exemplo concreto: uma tarefa (TAR.x) e o arquivo e a coluna em que se esperaria encontrar o processo dela, mostrando que essa informação não existe no backup.
6. **Cuidados**
   - Não reenviar as tabelas de senhas e credenciais (`credencialorgaosistema` e semelhantes).

## Detalhes técnicos
- Os números serão conferidos de novo nos registros da migração antes de gerar o PDF.
- Arquivo: `/mnt/documents/explicacao-suporte-projuris.pdf`, revisado visualmente.
