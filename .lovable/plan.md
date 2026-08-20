# Novas audiências criadas a partir de uma anterior: vínculo + aparecer no painel

## O que está acontecendo hoje (verificado no banco)

Quando se usa **Nova audiência (a partir da atual)**, o sistema copia o registro antigo inteiro. Isso traz três defeitos:

- A cópia herda `origem = pauta_excel` e `criado_por = vazio` do registro antigo. O Painel de Controle e Minha Agenda, no modo pessoal, ignoram justamente audiências de importação/pauta e sem criador — por isso a nova data **não aparece**.
- Advogados e envolvidos da audiência original **não são copiados** (as cópias de hoje estão com zero advogados vinculados), então ninguém "recebe" a nova audiência.
- Como nada aparecia, foram criadas 4 cópias idênticas do mesmo caso (processo 1000523-25.2026.5.02.0059, 13/10 09:10) em poucos minutos.

Quando a nova audiência é criada "do zero" (foi o caminho usado em 18/08), não existe vínculo nenhum com a audiência que já aconteceu.

## Os dois fluxos são diferentes (regra do escritório)

- **Reagendar**: só para audiência **cancelada/adiada** — é o mesmo ato, muda a data no próprio registro.
- **Nova audiência (a partir da atual)**: a audiência **aconteceu** e o juiz designou **outra** audiência — nasce um registro novo, vinculado ao anterior. É este o caso que hoje não aparece no painel.

O texto das telas e dos selos vai deixar essa diferença explícita, para não misturar os fluxos.

## O que será feito

1. **Nova audiência sai correta e visível**
   - A cópia passa a nascer como registro próprio: criador = usuário logado, origem = "reagendamento" (nunca importação/pauta), situação pendente, sem herdar tratamento do antigo.
   - Advogados e envolvidos da audiência original são copiados para a nova.
   - Resultado: a nova data aparece imediatamente no Painel de Controle, Minha Agenda, Kanban e na lista do processo.

2. **Vínculo visível nos dois lados**
   - Na nova audiência: selo "Originada da audiência de dd/mm/aaaa", clicável para abrir a anterior.
   - Na audiência antiga: selo "Reagendada para dd/mm/aaaa", clicável para abrir a nova.
   - O histórico da audiência antiga registra a criação da nova (de/para, motivo, autor, data/hora), somando-se ao registro automático de alterações já ativo.

3. **Audiência antiga fica como realizada, não como reagendada**
   - Ao criar a nova audiência, a anterior é marcada como **realizada** (audiência aconteceu) e sai das pendências do painel, sem nunca receber a marca de "reagendado" — essa marca continua exclusiva do fluxo Reagendar (cancelamento/adiamento).
   - O histórico da anterior passa a mostrar "Audiência realizada — nova audiência designada para dd/mm/aaaa".

4. **Vincular casos criados "do zero"**
   - No cadastro/edição de audiência, quando o processo já tem audiência anterior, aparece a opção "Vincular à audiência anterior" com sugestão automática da última audiência daquele processo.
   - Ação de limpeza: vincular retroativamente as audiências criadas nos últimos dias em que a nova data foi cadastrada sem vínculo (mesmo processo, mesma coordenação), para o histórico ficar completo.

5. **Sem cópias duplicadas**
   - Botão bloqueado durante o salvamento e aviso quando já existir audiência do mesmo processo na mesma data/hora, com opção de abrir a existente em vez de criar outra.

## Detalhes técnicos

- `ReagendarAudienciaDialog.tsx` (modo "nova"): remover herança de `origem`/`criado_por`/`tratado_*`; setar `criado_por = auth.uid()`, `origem = 'nova_audiencia'`, `status = 'pendente'`; replicar `audiencias_advogados` e `audiencia_envolvidos` do registro origem; inserir linha em `historico_reagendamentos_audiencia` (audiencia_id = original, `data_nova` = nova data, motivo = "nova audiência designada") e marcar o original como realizado/tratado — sem usar `status = 'reagendado'`, reservado ao modo "reagendar".
- Guardar-rail de duplicidade: consulta prévia por `processo_numero + data_audiencia + hora` antes do insert.
- Selos de vínculo: consulta por `originada_de` (filha) e por `id = originada_de` (pai) em `EditarAudienciaDialog`, `AudienciaKanbanCard` e `HistoricoReagendamentosAudiencia`.
- Vínculo manual: campo opcional em `CadastroAudienciaForm`/`CriarAudienciaProcessoDialog` gravando `originada_de` + linha de histórico.
- Limpeza retroativa: script de dados (UPDATE `originada_de`) para as audiências recentes sem vínculo, casando processo + coordenação com a audiência anterior mais próxima.
- Após gravar, seguir usando `invalidarItensAgenda` para atualizar painel, agenda, kanban e contadores sem recarregar a página.
