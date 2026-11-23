# Painel do dia no calendário do Painel de Controle (igual a Minhas Responsabilidades)

## O que muda para o usuário
- Ao clicar em um dia (ou em "+N mais") no calendário do Painel de Controle, abre um painel lateral direito **sobreposto**, largo (cerca de 720px), igual ao de Minhas Responsabilidades. O calendário não fica mais espremido ao lado.
- Cabeçalho com o dia por extenso, total de atividades, campo de busca e filtros por tipo (Tarefa, Prazo, Ata, Evento, Audiência) e por situação.
- Cada atividade mostra o máximo de informação: título, tipo com a cor, situação, datas (prevista/limite/fatal, hora), número do processo, partes, cliente, coordenação, responsáveis e envolvidos, observação resumida e os selos (anexo, workflow, publicação, "A" de acompanhamento, comentário, cobrança, modelo).
- Continua tudo o que o painel atual já faz: abrir a ficha da atividade, baixa rápida, ver atividades internas e o botão "Criar neste dia" (Tarefa, Prazo, Evento, Audiência).
- Fecha pelo X, tecla Esc ou clicando fora. Minhas Responsabilidades não muda.

## Detalhes técnicos
- `src/pages/PainelControle.tsx`: remover o `<aside>` fixo de 420/460px e renderizar o `DiaAgendaLateral` dentro de um `Sheet side="right"` (`sm:max-w-[720px]`, cabeçalho e rodapé fixos, meio rolável), controlado por `diaLateralKey`. Mantidos todos os callbacks atuais.
- `src/components/painel/DiaAgendaLateral.tsx`: adicionar busca e filtros de tipo/situação no topo (mesmo padrão do `ListaDiaResponsabilidade`) e ampliar `AgendaItemRow` em modo "detalhado" com processo, partes, cliente, coordenação, pessoas e observação, usando dados já carregados nos itens (sem novas consultas ao banco).
- Nenhuma alteração em banco, permissões ou contagens.
