# Lateral de Processos: lista de tarefas e atividades em largura total com mais detalhes

Hoje a aba "Tarefas e atividades" da lateral de Processos renderiza cada item com `AgendaItemRow` (componente shared com o Painel de Controle), mas as queries fazem `select("*")` sem joins — então campos como responsável (nome), assunto do processo, situação/status e observação nunca chegam populados, e a linha fica rasa. O usuário quer cada linha ocupando toda a largura do card lateral e com bem mais informação visível, no padrão do protótipo enviado.

## O que muda

- Cada item da lista passa a ocupar **toda a largura** do drawer (720px), sem recortes, com padding confortável e separação clara entre blocos.
- Cada linha exibe, quando existir:
  - **Etiqueta de tipo** colorida (PRAZO vermelho, AUDIÊNCIA dourado, TAREFA azul, EVENTO verde) — já existente, mantida.
  - **Título** + hora (quando houver) + badges de atividade/comentário/workflow inline.
  - **Número do processo** em cinza-mono abaixo do título.
  - **Responsável** (nome resolvido via join/batch de profiles).
  - **Situação/status** como badge compacto (ex.: Pendente, Em execução, Concluído, Cancelado).
  - **Datas** relevantes por tipo (data limite, data fatal, data da audiência + hora, data base etc.) já calculadas por `datasDoItem`.
  - **Observação** em até 2 linhas (line-clamp-2).
  - **Contagem de atividades** vinculadas como badge inline (em vez do texto solto abaixo da linha).
- Os cabeçalhos de grupo (Prazos / Audiências / Tarefas / Eventos) e os totalizadores no topo continuam iguais.

## O que não muda

- Nenhuma regra de negócio, consulta de duplicados/descartes, persistência, hooks de atividades ou edge functions.
- `AgendaItemRow` (usado no Painel de Controle) permanece intocado — o richer row é específico da lateral de Processos.
- Aba Resumo e aba Movimentações sem alteração.

## Detalhes técnicos

1. **Enriquecer as queries** em `src/components/processos/ProcessoItensLateral.tsx`:
   - `tarefas`: adicionar join `responsavel:profiles!tarefas_responsavel_id_fkey(id,nome)` e `processo:processos!tarefas_processo_id_fkey(id,numero,assunto,coordenacao_id)`.
   - `eventos_agenda`: join de `criado_por`/participantes resolvidos em lote via `profiles_basic` (mesmo padrão da agenda unificada) + `processo` quando houver `processo_id`.
   - `audiencias_detectadas`: já vêm com `processo_id`/`processo_numero`; resolver responsável quando houver campo de responsável.
   - Para qualquer `responsavel_id` sem join direto, buscar nomes em `profiles_basic` em um único `.in("id", ids)` e montar `item.responsavel = { id, nome }`.

2. **Novo subcomponente `ProcessoItemRow`** dentro do próprio `ProcessoItensLateral.tsx` (não exportado): layout full-width em `flex gap-3 px-4 py-3`, reaproveitando helpers de `DiaAgendaLateral` (`datasDoItem`, `horaDoItem`, `formatarData`, `formatarHora`, `TIPO_TEXTO`, `TIPO_LABELS`, `isItemTratado`, `isItemRiscado`, `TratadoCheck`, badges `AtividadeBadge`/`ComentarioBadge`/`WorkflowBadge`). Adiciona linha de processo (mono, cinza), linha de responsável, badge de situação (via `labelSituacaoItem` de `situacoesItem.ts`) e observação clamp-2. Contagem de atividades vira `<AtividadeBadge count={n} />` inline ao lado do título.

3. **Substituir** o `renderItem` que usa `AgendaItemRow` pelo novo `ProcessoItemRow`; remover o `<p>` solto de "N atividades vinculadas" (agora é badge inline).

4. **Largura total**: o drawer já é `w-[720px]` e a área de conteúdo é `flex-1` sem max-width; o novo row usa `w-full`. Garantir que `ScrollArea` e o container `divide-y` não adicionem padding lateral que reduza a largura útil.

5. Cores via tokens existentes (`text-red-600`, `text-yellow-600`, `text-blue-600`, `text-green-600`, `text-muted-foreground`, `bg-muted/50` etc.) — sem valores fixos.

6. Verificação: `npx tsgo --noEmit -p tsconfig.json` (build) e inspeção visual via Playwright (auth `external_unmanaged` — só rotas públicas verificáveis; a lateral exige sessão, então validar pelo build + leitura do render).
