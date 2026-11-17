# Pedidos da Isabela (Santander Cível) — plano por etapas

## 1 e 4 — Datas passadas (todo tipo de cadastro)
- Criar com data passada: bloqueado, com aviso dentro da própria janela explicando o motivo (tarefa, prazo, ata, evento, audiência).
- Editar atividades passadas: continua liberado.
- Importações e migrações (Projuris, planilhas): não bloqueiam; ao final mostram para quem está importando a lista de itens com data passada. Aviso só para quem está cadastrando, sem notificar outras pessoas.

## 2 — Data base em todos os tipos e preenchimento automático
- Data base visível em tarefa, prazo e ata (hoje falta no prazo); depois audiência e evento, se ela aprovar.
- Ao informar a data base:
  - se o tipo/modelo tem prazo cadastrado: calcula data prevista e fatal (dias úteis, feriados da coordenação);
  - se não tem: prevista e fatal recebem a mesma data base.
- Prevista e fatal continuam editáveis.
- Reorganizar a janela conforme o modelo enviado: nome em destaque + situação; quadro do processo (coordenação, nº, partes, assunto, etiquetas, tipo); tipo + prioridade; nome; base; prevista/fatal com hora; local/link; descrição; abas Atividades/Checklist/Comentários/Anexos/Histórico; recorrência; subatividade com data, responsável, situação e observação; Salvar/Cancelar.

## 3 — Corrigir tipo, subtipo (modelo) e título pela planilha
- Planilha: 3.516 tarefas e prazos futuros (17/11/2026 a 31/12/2027); usar colunas A (Tipo), B (Subtipo/modelo) e C (Título).
- Nova planilha Agenda Futura (3.040 linhas) traz o código da tarefa no Projuris (ex.: TAR.0103681): localizar cada atividade por esse código, que é único. Sem código encontrado, usar processo + data prevista + responsável.
- Corrigir Tipo, Subtipo (modelo) e Título conforme a planilha.
- Antes de gravar: relatório com o que será alterado, o que ficou ambíguo e o que não foi encontrado. Só gravo depois que você aprovar.
- Eventos não entram.

## 5 — Diário marcado como lido ao agendar
- Publicação marcada como lida automaticamente só depois que o agendamento é salvo com sucesso, igual em Análise DJEN, DJEN Servidor e publicações do processo.
- Os botões manuais continuam funcionando como hoje: Marcar como lida, Marcar todas como lidas, Marcar como não lida.

## 6 — Workflow: configurar todas as etapas ao iniciar
- Ao iniciar pelo botão Adicionar, cada etapa abre com os dados do modelo e pode ser alterada antes de criar: título, tipo, responsáveis, envolvidos, prazo/datas, prioridade, descrição. O modelo original não muda.

## 7 — Cores das situações
- Cores iguais ao Projuris, em todas as telas (Painel, agenda, lista, detalhe):
  - Concluída com sucesso: verde
  - Concluída sem sucesso: verde-azulado
  - Cancelado: vermelho
  - Pendente: cinza-azulado
  - Em execução: amarelo
  - A confirmar: azul
  - Revisão: laranja
  - Cancelar e ocultar da agenda: marrom
- Mantém o risquinho em cancelado/protocolado/baixado.

## Ordem sugerida
1. Item 3 (relatório de conferência, sem gravar)
2. Itens 1/4 e 5
3. Item 2 (datas automáticas + nova janela)
4. Item 6
5. Item 7

## Detalhes técnicos
- Prazo automático: usa o prazo do modelo de tarefa e `src/lib/feriados.ts`; data base gravada em `tarefas.data_base`.
- Correção da planilha casando `TAR.xxxx` com o código Projuris gravado na tarefa, via `run_sql`, atualizando `tipo_tarefa`, `modelo_tarefa_id` e `titulo`, com backup prévio dos valores antigos.
- Leitura do diário: marcar como lido no retorno bem-sucedido do salvamento, nunca antes.
- Workflow: ampliar `IniciarWorkflowDialog` com sobrescritas por etapa em `workflow_execucoes` (jsonb), sem alterar o modelo.
