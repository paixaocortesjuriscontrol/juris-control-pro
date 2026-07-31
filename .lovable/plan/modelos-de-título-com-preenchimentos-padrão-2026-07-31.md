# Modelos de Título com preenchimentos padrão

Hoje um modelo só preenche título e descrição. A ideia é permitir que cada modelo já traga valores padrão para os outros campos do formulário (datas, prioridade, tipo, local, horário etc.), de forma opcional.

## O que muda para a advogada

Na tela **Modelos de Título**, ao criar/editar um modelo aparece uma nova seção **"Preenchimentos padrão"**, com os campos correspondentes ao tipo escolhido (Prazo, Evento, Audiência, Tarefa, Parcela). Cada campo é opcional — em branco significa "não sugerir".

Datas usam regra relativa em vez de data fixa, para o modelo continuar válido no futuro:
- "Hoje", "Amanhã", "+N dias", "+N dias úteis", "próxima segunda"
- Exemplo: modelo "AUDIÊNCIA próxima semana" → Data = "+7 dias", Hora = "10:00"

Ao escolher o modelo no botão Modelos dentro do formulário, os campos configurados são preenchidos automaticamente. Campos que o usuário já preencheu manualmente não são sobrescritos (exceto o título, que sempre é aplicado). Um aviso curto mostra quantos campos foram preenchidos.

## Campos sugeríveis por tipo

- Prazo: data fatal / prazo, prioridade, tipo de prazo, observações
- Evento: data e hora de início/fim, local, tipo de evento, observações
- Audiência: data, hora, tipo de audiência, modalidade, local/link, observações
- Tarefa: data de vencimento, prioridade, tipo, observações
- Parcela: data da 1ª parcela, quantidade, valor, periodicidade

A lista final de cada tipo segue exatamente os campos que já existem no respectivo formulário.

## Detalhes técnicos

- Migração: adicionar coluna `padroes jsonb default '{}'::jsonb` em `modelos_titulo_coordenacao` (sem mudança de RLS/grants).
- `useModelosTitulo.ts`: incluir `padroes` no tipo `ModeloTitulo` e no salvamento.
- Novo `src/components/modelos/PadroesModeloEditor.tsx`: editor dos padrões, com o conjunto de campos definido por um mapa `tipo -> campos` em `src/constants/camposModeloTitulo.ts` (label, chave, tipo de input).
- Novo `src/lib/aplicarPadroesModelo.ts`: resolve valores relativos de data/hora (`hoje`, `+7d`, `+5du`, `prox_segunda`) para valores concretos no fuso BRT, respeitando a suspensão CLT já usada no projeto quando o campo for dias úteis.
- `ModeloTituloPicker.tsx`: manter a assinatura `onSelect(modelo)`; cada formulário passa a chamar `aplicarPadroesModelo(modelo, setters)` para aplicar os campos.
- Formulários atualizados: `PrazoDialog`, `EventoDialog`, `AudienciaFormSimplificado`, `EditarAudienciaDialog`, `NovaTarefaDialog`, `GerarParcelasDialog`.
- Sem sobrescrita de campos não vazios, e sem alteração em alertas/notificações.
