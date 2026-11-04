# Responsáveis seguem a coordenação escolhida

## O problema (pela imagem da Bruna)
No prazo ela escolhe a **Coordenação** (ex.: Execução GOL - Dra B. Anjos), mas a lista de **Responsáveis** abre com outra coordenação (a padrão dela, Dra. Vanessa Gomes - TST). Ela precisa trocar a coordenação de novo dentro da lista para achar a pessoa.

## O que muda
1. A lista de pessoas de **Responsáveis** e **Envolvidos** passa a abrir já na mesma coordenação escolhida no campo Coordenação do item.
2. Se ela trocar a Coordenação do item, a lista acompanha automaticamente.
3. Continua podendo escolher outra coordenação (ou todas) dentro da lista, se quiser alguém de fora — vale só para aquela vez.
4. Sem coordenação escolhida no item, continua como hoje (coordenação padrão do usuário).
5. Vale para Prazo, Tarefa, Evento e Audiência, em todos os lugares do botão Adicionar (Painel de Controle, Processos e casos, Análise DJEN) e na edição.

Responsáveis fixos por coordenação (já existentes em "Responsáveis fixos" do tipo de item) continuam sendo incluídos automaticamente; se a coordenação dela ainda não tiver, o coordenador pode cadastrar lá para a pessoa já vir marcada.

## Detalhes técnicos
- `src/components/shared/PeoplePicker.tsx`: nova prop opcional `coordenacaoId`. O efeito que define `coordFiltro` passa a priorizar `coordenacaoId` (se acessível na lista) sobre `coordPadraoId`; quando `coordenacaoId` muda, reseta `coordFiltroTouched` e reaplica.
- Passar `coordenacaoId` nos `PeoplePicker` de `PrazoDialog.tsx`, `NovaTarefaDialog.tsx`, `TarefaAgendaPanel.tsx`, `AudienciaFormSimplificado.tsx` e formulário de evento.
- Sem alteração no banco nem nas permissões.
