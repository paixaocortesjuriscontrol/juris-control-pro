# Códigos Projuris repetidos entre Santander Cível e Santander Trabalhista

## O que foi conferido
- A planilha enviada pela Trabalhista tem 179 atividades, com códigos de TAR.0002762 a TAR.0007630.
- Conferi uma amostra no sistema. Cada código está na Santander Trabalhista, no **mesmo processo** e com o título certo (ex.: TAR.0007625 → 0000125-77.2026.5.18.0018, Embargos de Declaração).
- Nenhum dos 33 códigos que se repetem entre as duas equipes está nessa planilha.

## Por que os códigos se repetem
As duas equipes vieram de **bases Projuris separadas**, e cada base começa a contar do TAR.0000001:
- **Trabalhista:** 6.770 atividades, de TAR.0000440 a TAR.0007630. Quase todas são de processos trabalhistas (6.375) e foram importadas em 01/10.
- **Cível:** 2.986 atividades, de TAR.0000768 a TAR.0105048. São processos da justiça estadual (2.847).

O mesmo número aparece nas duas equipes, mas em processos e atividades diferentes. Por exemplo, TAR.0000768 é "Acompanhamento" num processo cível e "Audiência inicial" num processo trabalhista. Por isso a importação está certa e nada precisa ser apagado ou corrigido.

## Proposta (só prevenção, sem mexer nos dados)
1. Toda busca ou correção pelo código Projuris passa a usar **código + equipe**, nunca só o código. Assim, uma correção numa equipe não altera a outra. A correção de tipo/subtipo da Cível já foi feita assim.
2. Mostrar a equipe junto do código no detalhe da tarefa, para ninguém achar que é a mesma atividade.
3. Opcional: fazer a conferência completa das 179 linhas e entregar um relatório Excel.

## Detalhes técnicos
- Revisar os importadores Projuris e os casamentos por `tarefas.identificador_projuris`, para que sempre filtrem por `coordenacao_id`.
- Não há alteração de banco nem de dados.
