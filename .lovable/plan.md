# Tarefas Projuris duplicadas entre migrações

## O que foi confirmado
A Lis tem razão. No processo 4001072-56.2026.8.26.0320, a tarefa Projuris TAR.0091443 ("ACOMPANHAMENTO") existe duas vezes:
- uma cópia da migração antiga (cadastro de 27/08), que vencia em 27/11 e que ela marcou como cumprida;
- uma cópia da migração de 25/11, que ela remarcou para 14/12.

O código Projuris foi gravado de dois jeitos diferentes ("TAR.0091443" na migração antiga e o número interno "58517873" na de 25/11). Por isso a migração não percebeu que a tarefa já existia.

Ao todo, 6.161 tarefas da migração de 25/11 repetem uma tarefa de migração anterior, todas na mesma coordenação. Em 616 desses pares, as duas cópias continuam em aberto e aparecem em dobro na agenda.

## Passos
1. Gerar um Excel de conferência com os 6.161 pares: processo, título, coordenação, responsáveis, situação e datas das duas cópias, além de quem alterou cada uma depois de 25/11. Nada é alterado nesse passo.
2. Corrigir a Migração Projuris para reconhecer uma tarefa já existente pelos dois formatos do código (TAR.xxxx e o número interno). Assim, migrações futuras não criam a tarefa de novo.
3. Corrigir as duplicadas só depois que você aprovar o critério, olhando o Excel. A sugestão é cancelar (não apagar) a cópia que ninguém mexeu e manter a que a equipe usou. Quando a equipe usou as duas, o par fica para decisão manual. Tudo terá backup e nenhuma notificação será disparada.
4. Avisar a Lis de que a cópia de 14/12 é a que vale.

## Detalhes técnicos
- Chave de deduplicação: `identificador_projuris` normalizado, aceitando o código `TAR.\d+` e também o código extraído de `observacoes` ("Identificador Projuris: TAR.xxxx").
- O ajuste acontece na rotina de importação de tarefas da Migração Projuris, e a regra vai para o AGENTS.md.
- A correção dos dados (passo 3) usa `status = cancelado` com backup em uma tabela `backup_dup_projuris_<data>`; nada é apagado.
