# Limpeza: tarefas importadas por engano na Coordenação DJEN Termos Kurier

## Diagnóstico (confirmado no banco)
- A coordenação "Coordenação DJEN Termos Kurier" tem **1.882 itens** na tabela de tarefas.
- **Todos** têm origem `astrea`, foram criados pelo usuário **Admin. Paixão Cortes** entre 08/06/2026 e 03/08/2026, e **nenhum** tem processo vinculado.
- Distribuição: 1.511 concluídos (`cumprido`), 350 pendentes, 21 cancelados. Tipos: Prazo, Tarefa, Evento, Audiência.
- Causa: a aba Astrea de "Importar Tarefas" foi executada com essa coordenação selecionada no seletor de coordenação, então todos os itens da planilha caíram nela.

## O que será feito
Excluir definitivamente esses 1.882 itens, restritos a:
- coordenação = Coordenação DJEN Termos Kurier, **e**
- origem = `astrea`, **e**
- sem processo vinculado.

Nenhum item de outra coordenação, de outra origem ou vinculado a processo é tocado.

## Ordem da limpeza
Antes de apagar as tarefas, removo os registros dependentes dessas mesmas tarefas para não violar chaves estrangeiras:
- responsáveis e envolvidos da tarefa
- comentários da tarefa
- vínculos com publicações (e com processos das publicações)
- tarefas relacionadas
- subatividades / atividades do item
- registros de auditoria e alertas ligados a essas tarefas

Depois disso, as 1.882 tarefas são apagadas.

## Verificação
Após a exclusão, confirmo por consulta que a coordenação ficou com 0 itens de origem `astrea` e que os totais das outras coordenações permaneceram iguais.

## Observações
- A operação é irreversível (sem backup automático). Se preferir, posso primeiro exportar as 1.882 linhas em CSV antes de apagar — diga se quer isso.
- Conforme sua resposta, **não** vou alterar o importador Astrea.
