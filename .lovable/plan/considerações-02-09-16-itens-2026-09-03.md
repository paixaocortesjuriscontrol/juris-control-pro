# Considerações 02/09 — 16 itens

Pulados por sua decisão: item 15 do documento (tarefas do Ástrea) e a criação/desduplicação de usuários (fica para depois; só o diagnóstico do erro entra na Leva 4).

A lista vai para `roadmap.md` na raiz, incluindo os ajustes desta última mensagem, e é executada nas levas abaixo. Onde a causa ainda não está confirmada, o primeiro passo é diagnosticar antes de mexer.

## Leva 1 — Bugs que quebram uso

1. **Nova tela "Reatribuir Processos" (item 01)** — tela própria no menu, completa e profissional, substituindo o fluxo atual em dialog:
   - lista **todos os processos** com paginação no servidor, busca por número/parte/assunto e filtros por coordenação, responsável atual e situação;
   - seleção em massa (linha, página, "todos os filtrados") com contador;
   - painel de destino: nova coordenação e/ou novo responsável, com resumo antes de confirmar;
   - ao remover alguém de uma coordenação, o fluxo obriga a escolher o destino dos processos dessa pessoa e lista o que será movido;
   - nesse fluxo de exclusão, a lista traz **apenas processos não concluídos e não cancelados** (o caso José Adrino Xavier: 2 na lista e 0 na reatribuição — investigo a divergência de filtro entre as duas consultas antes de alterar);
   - gravação em lotes com feedback de progresso e registro de auditoria.
2. **"Marcar como ciente" não pode sumir da tela (item 17 do doc)** — a divergência marcada permanece visível, com aparência de "já visto" (igual aos andamentos), em vez de desaparecer. Filtro para alternar entre pendentes/todas e a contagem passa a considerar só as pendentes.
3. **Botão "Buscar mais do servidor (+500)" (item 08)** — o rótulo/condição está errado: aparece "+500" com total filtrado de 13. Exibir só quando houver mais no servidor e com o número correto.
4. **Ranking do TST parou de funcionar (item 10)** — diagnosticar a tela de Ranking e a função de ranking TST (erro de consulta, filtro de período ou dados) e corrigir a causa encontrada.

## Leva 2 — Agenda e recorrências

5. **Divergência de calendário (item 12)** — comparar o que a Dra. Janaina vê no perfil dela com o que o Admin vê selecionando a coordenação dela e igualar o conjunto de itens.
6. **Recorrente alterado de dias corridos para dias úteis (item 13)** — ao trocar a regra de um recorrente existente, as ocorrências futuras são recalculadas em dias úteis.
7. **Nova situação "Cancelar e ocultar da agenda" (item 11)** — para atividades recorrentes: cancela e remove da agenda/calendário sem apagar o histórico.
8. **Definir a data direto no calendário (item 14)** — clicar num dia abre a criação já com aquela data.
9. **Baixar a pendência pela tela principal — pop-up completo estilo Ástrea (item 18 do doc)** — clicar na pendência no painel abre um pop-up com: identificação (processo, partes, título, tipo), situação/resultado, data de cumprimento, hora, responsável que baixou, campo de observação/andamento, anexo opcional, opção de criar o próximo prazo/tarefa a partir da baixa, e ações Salvar / Salvar e próximo / Cancelar — tudo sem sair da tela, com atualização imediata da lista.

## Leva 3 — Análise DJEN e processos

10. **Não perder os filtros (item 02)** — ao criar tarefa a partir de uma publicação e voltar para a Análise DJEN, filtros e posição na lista são preservados.
11. **"Ver processo" abre em nova aba (item 05)**.
12. **Partes logo abaixo do número do processo (item 06)** — sem precisar abrir a publicação inteira.
13. **Pesquisa global (item 09)** — a busca do topo deixa de trazer todas as publicações, exceto na tela de Análise DJEN.
14. **Processos e casos: pendentes primeiro (item 03)** — ordenação da lista de prazos/eventos/tarefas com os pendentes no topo.
15. **Balãozinho de comentários no topo do Painel de Controle (item 04)** — ícone de comentário no cabeçalho do Painel com bolinha indicando o **total de comentários não vistos** do usuário; ao clicar, abre a lista dos comentários novos (tarefa/processo, autor, trecho, data) e ir para o item marca como visto. Requer registro de leitura por usuário/comentário.

## Leva 4 — Consultas e investigações

16. **Processos em comum Dr. Thonmás / Dra. Janaina (item 07)** — levanto a lista no banco e entrego em planilha.
17. **Exportar os comentários das tarefas** — exportação XLSX dos comentários por processo/período.
18. **Acatar a sugestão da Judit (item 16 do doc)** — botão "Acatar" ao lado de cada sugestão, junto do "Ciente": aplica o valor da Judit ao campo correspondente do processo (Tribunal, Classe, Assunto, Vara/Câmara, Instância, Pedidos, Fase) e marca a divergência como resolvida, mantendo a linha visível com a marca de aplicada.
19. **Erro ao criar/editar usuário** — diagnóstico do "Edge Function returned a non-2xx status code" e relatório do motivo; cadastros e a duplicidade da Julia Rocha ficam para depois.

## Notas técnicas

- Nova rota/página para reatribuição (padrão das páginas em `src/pages`), entrada em `src/config/menuItems.ts` restrita a admin/coordenador; reaproveita `ReatribuirProcessoDialog`/`DistribuirProcessoDialog` como base da lógica de gravação.
- Item 2: `src/components/djen/AcompanhamentoEspecialDivergencias.tsx` passa a filtrar por estado em vez de esconder resolvidas (`resolvido_em` já existe na tabela).
- Item 15 exige tabela/coluna de leitura de comentários por usuário — confirmo o desenho antes da migração.
- Item 7 (nova situação) pode exigir ajuste do enum `status_tarefa`; confirmo o impacto antes de aplicar.
- Demais alvos já mapeados: `src/pages/AnaliseDjen.tsx` e `AnaliseDjenServidor.tsx` (itens 3, 10-13), `src/pages/RankingAtendimento.tsx` (item 4), `src/components/agenda/*` + `src/hooks/useAgendaUnificada.ts` (Leva 2), `src/pages/PainelControle.tsx` (itens 9 e 15).
- Cada leva termina com verificação de build, conferência dos números no banco quando envolve dados, e sobe a versão do app com entrada no changelog.
