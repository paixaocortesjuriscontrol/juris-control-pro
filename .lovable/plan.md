# Reclamação da Dra. Janaina: coordenação sumindo em atividades e prazos

## O que já foi conferido
- No banco, nenhuma tarefa, prazo, evento ou audiência está sem coordenação.
- Nos últimos 3 dias, nenhum salvamento trocou a coordenação de uma atividade ou de um prazo dela. Os únicos itens que mudaram de coordenação foram os processos que você pediu para mover em 09/11.
- Até agora, nada indica que a coordenação tenha sido apagada. Se ela sumiu, o mais provável é que ela não esteja aparecendo na tela.

## Pode ser a mudança de ontem?
Pode, mas só na tela, e isso ainda não está confirmado. A mudança de ontem fez o campo Coordenação mostrar todas as coordenações para quem é coordenador. Isso vale nas telas de Prazo, Evento, Audiência e Tarefa delegada.
Esse campo só mostra o nome que está na lista dele. Para quem não é coordenador, a lista tem só as coordenações de que a pessoa faz parte. Se o item é de uma coordenação que não está na lista, o campo aparece vazio, mesmo com a coordenação gravada. Isso pode passar a impressão de que a coordenação foi perdida.
O campo também escolhe sozinho a coordenação do usuário quando está vazio. Ao abrir um item salvo, ele pode fazer isso antes de o item terminar de carregar. Hoje isso não trocou nenhum item dela, mas é um risco.

## O que fazer
1. Confirmar a tela: pedir à Dra. Janaina um print e o número de um processo em que a coordenação aparece vazia. Depois, olhar esse item no banco.
2. Mostrar sempre a coordenação gravada: se o item for de uma coordenação que não está na lista da pessoa, o campo mostra o nome dela mesmo assim, em vez de ficar vazio.
3. Evitar troca automática ao editar: em item já salvo, o campo não escolhe a coordenação sozinho. Isso só acontece ao criar um item novo.
4. Conferir de novo no banco que nada mudou de coordenação sem alguém escolher.

## Detalhes técnicos
- `src/components/shared/CoordenacaoSelect.tsx`: quando `value` não está em `coordenacoes`, buscar `id, nome` desse ID e incluir na lista (só para mostrar). Criar a prop `isEdicao` ou `autoSelect`, que desliga o `useEffect` de pré-seleção.
- Passar a nova prop em `PrazoDialog`, `EventoDialog`, `AudienciaFormSimplificado` e `GerarParcelasDialog` quando estiverem editando.
- Nenhuma mudança no banco nem nas permissões.
