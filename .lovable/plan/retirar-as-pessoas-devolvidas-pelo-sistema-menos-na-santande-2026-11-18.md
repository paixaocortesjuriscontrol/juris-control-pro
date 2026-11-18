# Retirar as pessoas devolvidas pelo sistema, menos na Santander Cível

## O que será retirado
Saem todas as pessoas que o sistema colocou de volta em 18/11 às 15h19 (BRT), em todas as coordenações, **menos a Coordenação Santander Cível**, que ainda está decidindo.

- **Responsáveis:** saem 119 de 135.
- **Envolvidos:** saem 6.
- **Quem fica:** os 16 que são o responsável principal da atividade continuam, para nenhuma atividade ficar sem dono.

| Coordenação | Responsáveis devolvidos | Principais mantidos |
|---|---|---|
| Execução GOL - Dra B. Anjos | 47 | 3 |
| Coordenação GOL | 33 | 10 |
| GOL - Norte e Nordeste | 16 | 0 |
| Coordenação Fernanda | 10 | 1 |
| GOL - Casos Especiais | 8 | 0 |
| Dra. Janaina Catunda | 8 | 2 |
| Dra. Beatriz Costa | 6 | 0 |
| Santander Trabalhista | 6 | 0 |
| Kurier | 1 | 0 |

Atenção: as pessoas da Dra. Janaina que voltaram pela recuperação, Júlia e Bruna no processo 0001281-19.2026.5.10.0020, também saem, porque o pedido inclui todas as coordenações.

## Como
- Antes de apagar, guardo uma cópia de cada linha retirada, visível só para admins, para poder desfazer.
- Só saem as linhas criadas pela devolução, entre 15h19 e 15h20 (BRT). Quem alguém incluiu depois disso não é tocado.
- A Santander Cível fica como está até a planilha conferida voltar.
- Depois, conferir se a tela de edição coloca de volta o criador ou a pessoa pré-cadastrada (queixa "volta mesmo editando").

## Detalhes técnicos
- As linhas retiradas são as de `tarefa_responsaveis` e `tarefa_envolvidos` com `created_at` entre 18:19 e 18:20 UTC, cuja coordenação da tarefa é diferente de `968631d0…`, e que não são o `tarefas.responsavel_id`.
- A cópia vai para tabelas de backup antes do `DELETE`.
