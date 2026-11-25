# Ajuste de coordenações – planilha da Bruna Sousa (GOL / Janaina)

## O que a planilha traz
83 processos na aba "Processos":
- 15 sinalizados em amarelo -> ficam só na **Coordenação Dra. Janaina Catunda**
- 17 com etiqueta 1968 (sem amarelo) -> ficam só em **Execução GOL - Dra B. Anjos** e **GOL Especiais - Sindicatos e MPT**
- 51 demais -> ficam só na **Coordenação GOL**

Nenhum caso amarelo tem etiqueta 1968, então não há conflito entre as regras.

## O que será feito
1. Localizar cada processo pelo número (só dígitos) e conferir as coordenações atuais; listar os não encontrados.
2. Fazer backup das coordenações e vínculos atuais desses processos antes de qualquer alteração.
3. Para cada processo:
   - Definir a coordenação principal (Janaina, GOL ou Execução GOL - Dra B. Anjos para os 1968).
   - Manter/criar vínculo apenas nas coordenações de destino e remover os vínculos de coordenações fora da regra.
   - Pessoas responsáveis do processo ligadas às coordenações removidas deixam de ficar vinculadas por elas; as das coordenações mantidas permanecem.
4. Não alterar tarefas, prazos, audiências e publicações, nem outros processos (regra de isolamento por coordenação).
5. Entregar um Excel de conferência: antes x depois por processo, mais os não encontrados.

## Pontos de atenção
- A aba "Tarefas em coord. trocada" (3 processos com tarefas na coordenação da Janaina, mas processo em GOL Especiais) é apenas informativa; as atividades não serão movidas, salvo pedido.
- Alteração direta nos dados, sem mudança de telas.

## Detalhes técnicos
- Tabelas: `processos.coordenacao_id`, `processos_coordenacoes_responsaveis`, `processos_responsaveis.coordenacao_id`.
- Backup em tabela `backup_coord_gol_janaina_20261125` antes do UPDATE/DELETE, executado em transação.
