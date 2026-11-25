# Apagar tarefas do Projuris com data depois de 13/11/2026 (Santander Cível)

## Por que existem
A data de corte foi criada depois das migrações de 13/11 e 14/11/2026. Essas duas rodadas importaram tudo, inclusive tarefas futuras, e a limpeza anterior não as removeu. A migração de 25/11 já respeitou o corte (nenhuma tarefa depois de 13/11).

## O que será feito
1. Selecionar só tarefas da Coordenação Santander Cível que vieram da migração Projuris (registro na migração) e têm data limite, fatal, prevista ou base depois de 13/11/2026 (BRT): 3.301 tarefas (2.957 de 13/11 e 344 de 14/11).
2. Gerar o arquivo de backup em Excel (`/mnt/documents/backup_tarefas_projuris_apos_13-11_3301.xlsx`) com todos os dados: código Projuris, título, processo, situação, datas, responsáveis, envolvidos e comentários.
3. Guardar também uma cópia completa no banco (tarefas, responsáveis, envolvidos, comentários e anexos ligados), para poder restaurar.
4. Apagar essas tarefas sem enviar aviso à equipe. Os anexos de arquivo continuam guardados; só a ligação com a tarefa sai.
5. Marcar no histórico da migração que esses itens foram removidos, para a tela de Migração Projuris não contá-los como "já migrados".
6. Conferir: 0 tarefas da migração com data depois de 13/11; tarefas criadas pela equipe e por workflows/DJEN intactas.

## Fora do escopo
Tarefas criadas manualmente, por workflow ou pela Análise DJEN (355 com data futura) não serão tocadas.
