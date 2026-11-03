# Pendências da Santander Cível — conferência e o que falta

## Conferência
| Pedido | Situação |
|---|---|
| Planilha modelo de importação | Pronto (botão "Baixar planilha modelo" no envio em lote, feito agora) |
| Etiqueta no processo | Já existe (seletor de etiquetas na ficha do processo) |
| Etapas no workflow | Já existe (editor de workflow com etapas, prazos, responsáveis) |
| Feriados nacionais como dias não úteis, opcional por equipe | **Falta** — hoje "dias úteis" só pula sábado e domingo |
| Responsáveis no modelo de tarefas | **Falta** — a tela Modelos de tarefas não tem esse campo |

## O que construir

### 1. Feriados nacionais por coordenação
- Lista de feriados nacionais já carregada (fixos + Carnaval, Sexta-feira Santa e Corpus Christi calculados por ano).
- Na página da coordenação, um cartão "Feriados" com chave liga/desliga "Considerar feriados nacionais como dias não úteis" (desligado por padrão) e opção de incluir feriados próprios da equipe.
- Quando ligado, os prazos em dias úteis dos workflows e das tarefas daquela coordenação pulam esses feriados.

### 2. Responsáveis no modelo de tarefas
- Na tela Modelos de tarefas, campo para escolher responsáveis (e envolvidos) entre os membros da coordenação do modelo.
- Ao criar tarefa a partir do modelo, esses responsáveis entram preenchidos automaticamente (podendo ser alterados).

## Detalhes técnicos
- Nova tabela `feriados` (data, nome, coordenacao_id nulo = nacional) com GRANTs e RLS (leitura para autenticados; escrita para admin/coordenador da coordenação). Ajuste em `configuracoes`/`coordenacoes` para a flag `usar_feriados_nacionais`.
- `calcularDataOffset` em `workflowExecutor.ts` e o cálculo de prazos úteis passam a receber o conjunto de feriados da coordenação; testes com Carnaval/Natal.
- Responsáveis do modelo guardados em `modelos_titulo_coordenacao.padroes` (responsaveis/envolvidos), aplicados por `aplicarPadroesModelo.ts`, sem mudar RLS.
