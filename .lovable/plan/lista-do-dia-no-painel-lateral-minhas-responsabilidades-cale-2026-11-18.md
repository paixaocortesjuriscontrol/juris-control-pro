# Lista do dia no painel lateral (Minhas Responsabilidades → Calendário)

## O que muda
- No calendário de **Minhas Responsabilidades**, clicar no número do dia, num espaço vazio do dia ou em "+N mais" abre um **painel lateral direito** com **todas** as atividades daquele dia, não só as 5 que cabem no quadradinho. Clicar no título de uma atividade continua abrindo a ficha completa, como hoje.
- O cabeçalho do painel mostra a data por extenso (ex.: "Segunda-feira, 23 de novembro de 2026") e um resumo do dia: total, quantas estão em aberto, atrasadas e concluídas, e quantas há de cada tipo (Tarefa, Prazo, Ata, Evento, Audiência).
- Cada atividade aparece num cartão com a cor do tipo e com:
  - título, tipo, situação, prioridade e hora;
  - data base, data limite (prevista) e data fatal;
  - número do processo (com botão de copiar), partes (polo ativo × polo passivo), cliente e coordenação;
  - responsáveis e envolvidos;
  - primeira linha da observação/descrição;
  - as mesmas marcas do calendário: A vermelho (acompanhamento especial), workflow, publicação, comentários, anexos, cobrança e o V de tratado; riscado e verde seguem as mesmas regras de hoje.
- Clicar num cartão abre a ficha completa da atividade (a mesma ficha ampla de hoje). Ao fechar a ficha, a lista do dia continua aberta.
- O painel tem campo de busca e um filtro rápido por tipo e situação, e segue os filtros que já estão ligados na tela.
- Só muda o calendário de Minhas Responsabilidades; o Painel de Controle fica como está.

## Detalhes técnicos
- Novo `src/components/minhas-responsabilidades/ListaDiaResponsabilidade.tsx`: `Sheet` do lado direito (largura de cerca de 720px), com cabeçalho e rodapé fixos e meio rolável (padrão de painel lateral do projeto).
- Recebe a mesma lista do dia (`doDia`, já calculada a partir de `filtrados`), mais `paraItemAgenda` e os mapas de marcas (`mapaComentarios`, `mapaCobrancas`, `itensDeWorkflow`, `itensDePub`, `processosAcompanhados`). Assim não há consultas novas para as marcas.
- Partes e responsáveis vêm dos campos que já estão carregados no item; o que faltar aparece como "—", sem novas consultas por item.
- `MinhasResponsabilidades.tsx`: novo estado `diaSel`; a célula do dia e "+N mais" abrem a lista; os botões das atividades usam `stopPropagation` para continuar abrindo a ficha.
- Sem mudanças no banco.
