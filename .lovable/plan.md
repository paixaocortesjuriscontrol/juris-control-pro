# Cadastrar compromissos Projuris na Santander Cível

## O que tem na planilha
- 174 compromissos, todos "Não concluído", identificadores TAR. únicos.
- Coluna "AGENDAR COMO": 125 EVENTO, 29 TAREFA, 20 AUDIÊNCIA.
- Nenhum processo vinculado na planilha. Nas 20 audiências, o número do processo vem dentro da observação (data, hora, CNJ, local, partes, pedidos).
- Responsáveis separados por "|" (alguns com até 5 pessoas).

## Como será cadastrado (tudo na Coordenação Santander Cível)
- **Tipo**: segue a primeira coluna (Evento → evento, Tarefa → tarefa, Audiência → audiência). Aqui vale a coluna da planilha, não a lista fixa de títulos usada na Agenda Futura.
- **Título**: "TÍTULO DO EVENTO"; usa modelo de tarefa existente da coordenação quando o nome coincidir.
- **Datas**: início/horário/término do compromisso; data de conclusão prevista como data do item; data de inclusão guardada.
- **Responsáveis**: cada nome separado por "|", reconhecendo nomes parecidos; quem não for achado vai no relatório.
- **Audiências**: o processo é procurado pelo número da observação; se existir, fica vinculado; senão fica sem processo e entra no relatório. A observação inteira vai na descrição.
- **Identificador Projuris (TAR.x)**: gravado no item e no histórico da migração, para a futura migração dos CSVs reconhecer e não duplicar.
- Rodar de novo não duplica (pula TAR. já gravados); lote pode ser desfeito pelo histórico.
- Relatório Excel ao final: criados, vinculados, pessoas não encontradas, audiências sem processo.

## Como fazer
Adicionar na tela Migração Projuris um importador "Compromissos" reaproveitando o da Agenda Futura (barra de progresso, Cancelar, relatório). Você envia a planilha lá depois de publicar.

## Detalhes técnicos
- Novo parser em `src/components/migracao/compromissosProjuris.ts` + testes (tipo pela coluna A, split "|", CNJ extraído do OBS).
- Itens auditados em `migracoes_projuris_itens` (tipo tarefa/evento/audiencia, chave TAR.x), igual à Agenda Futura.
- Sem mudança de banco.
