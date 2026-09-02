# Considerações 02/09 — 16 itens

Itens pulados por decisão sua: item 15 (tarefas do Ástrea) e a criação/desduplicação de usuários (fica para depois; o erro "Edge Function returned a non-2xx" entra apenas como investigação na Leva 4).

A lista vai para `roadmap.md` na raiz e é executada nas levas abaixo. Onde a causa ainda não está confirmada, o primeiro passo é diagnosticar antes de mexer.

## Leva 1 — Bugs que quebram uso

1. **Exclusão/reatribuição por coordenação (item 01)** — na tela de administração de processos, ao remover alguém da coordenação, listar os processos dessa pessoa e obrigar a escolha do destino. A lista deve trazer **somente processos não concluídos e não cancelados**. Caso relatado: José Adrino Xavier aparece com 2 na lista e 0 na reatribuição — investigar a divergência de filtro entre as duas consultas antes de alterar.
2. **"Marcar como ciente" some com tudo (item 17)** — ao marcar uma divergência Judit como ciente, apenas aquela linha deve sair; o processo permanece com as demais pendências. Investigar se a marcação está gravando por processo em vez de por campo.
3. **Botão "Buscar mais do servidor (+500)" (item 08)** — o rótulo/condição está errado: mostra "+500" quando o total filtrado é 13. Exibir o botão só quando houver mais no servidor e com o número correto.
4. **Ranking do TST parou de funcionar (item 10)** — diagnosticar a tela de Ranking e a função de ranking TST (erro de consulta, filtro de período ou dados) e corrigir a causa encontrada.

## Leva 2 — Agenda e recorrências

5. **Divergência de calendário (item 12)** — comparar o que a Dra. Janaina vê no perfil dela com o que o Admin vê selecionando a coordenação dela e igualar o conjunto de itens.
6. **Recorrente alterado de dias corridos para dias úteis (item 13)** — ao trocar a regra de um evento recorrente já existente, as ocorrências futuras devem ser recalculadas em dias úteis.
7. **Nova situação "Cancelar e ocultar da agenda" (item 11)** — disponível para atividades recorrentes: cancela a ocorrência e a remove da agenda/calendário, sem apagar o histórico.
8. **Definir a data direto no calendário (item 14)** — ao clicar num dia do calendário, abrir a criação já com aquela data preenchida.
9. **Baixar a pendência da tela principal (item 18)** — clicar na pendência no painel principal abre um pop-up de baixa (estilo Ástrea) com situação, data de cumprimento e observação, sem sair da tela.

## Leva 3 — Análise DJEN e processos

10. **Não perder os filtros (item 02)** — ao criar tarefa a partir de uma publicação e voltar para a Análise DJEN, os filtros e a posição na lista são preservados.
11. **"Ver processo" abre em nova aba (item 05)**.
12. **Partes logo abaixo do número do processo (item 06)** — evita abrir a publicação inteira para saber quem são as partes.
13. **Pesquisa global (item 09)** — a busca do topo deixa de trazer todas as publicações, exceto quando o usuário está na tela de Análise DJEN.
14. **Processos e casos: pendentes primeiro (item 03)** — ordenação da lista de prazos/eventos/tarefas com os pendentes no topo.
15. **Balãozinho de comentários nas tarefas (item 04)** — ícone com a contagem de comentários; ao clicar, abre os comentários da tarefa.
16. **Exportar os comentários das tarefas (item 15 do doc, parte de exportação)** — exportação dos comentários (XLSX) por processo/período.

## Leva 4 — Consultas e investigações

17. **Processos em comum Dr. Thonmás / Dra. Janaina (item 07)** — levanto a lista no banco e entrego em planilha.
18. **Acatar a sugestão da Judit (item 16)** — além de "Ciente", uma ação que aplica o valor sugerido pela Judit ao campo do formulário (Tribunal, Classe, Assunto, Vara, Instância, Pedidos, Fase).
19. **Erro ao criar/editar usuário** — diagnóstico do "Edge Function returned a non-2xx status code" e relatório do motivo; os cadastros e a duplicidade da Julia Rocha ficam para depois, conforme sua escolha.

## Notas técnicas

- Arquivos-alvo já identificados: `src/components/coordenacoes/ReatribuirProcessoDialog.tsx` e `src/pages/Coordenacoes.tsx` (item 1); `src/pages/AnaliseDjen.tsx` e `AnaliseDjenServidor.tsx` (itens 3, 10-13); `src/pages/RankingAtendimento.tsx` + função de ranking TST (item 4); `src/components/agenda/*` e `src/hooks/useAgendaUnificada.ts` (Leva 2); `src/pages/PainelControle.tsx` (item 9).
- Itens 7 (nova situação) e 16 (exportar comentários) podem exigir migração/ajuste de enum de situação e novos filtros de consulta; confirmo o impacto antes de aplicar.
- Cada leva termina com verificação de build e, quando envolve dados, conferência dos números direto no banco antes de eu declarar pronto.
- Versão do app sobe ao final de cada leva concluída, com entrada no changelog.
