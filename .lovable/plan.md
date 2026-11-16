# Análise das 7 solicitações

## O que já existe (procede parcialmente ou não procede)

1. **Ajustar datas a qualquer momento** — Já é possível. Quando os campos de data aparecem travados, é porque a coordenação desligou essa permissão para aquele cargo (configuração "quem pode alterar datas"). Ação: só revisar a configuração da coordenação, sem mudar o sistema.
5. **Marcar intimação como lida ao agendar** — Já acontece ao criar item pela janela "Nova tarefa da publicação". Ação: conferir os outros caminhos (botão Adicionar dentro da publicação, vínculo a item já existente) e aplicar a mesma marcação onde faltar.

## O que procede e precisa ser feito

2. **Só Data Base e Data Fatal** — Hoje há Data Inicial, Limite e Fatal. Proposta: na criação/edição de Prazos, mostrar só "Data Base" (início da contagem) e "Data Fatal"; a Data Limite deixa de aparecer, preservando o que já está gravado.
3. **Corrigir tipos das atividades futuras** — Aguardar o relatório da coordenação (prazo/tarefa e tipo correto) e converter em lote, com conferência e registro na auditoria, como foi feito com os "ACOMPANHAMENTO".
4. **Alerta de atividade criada para data passada** — Ao salvar com data fatal/data anterior a hoje (BRT), mostrar aviso pedindo confirmação; opcionalmente avisar o coordenador.
6. **Preencher todas as etapas ao criar workflow** — No início do workflow, abrir um formulário com todas as etapas para informar dados (responsáveis, datas, descrição) de uma vez, que serão usados quando cada etapa for gerada.
7. **Cores nas situações** — Cada coordenação escolhe uma cor por situação (no menu Coordenação); a situação aparece colorida no Painel, Lista e ficha.

## Detalhes técnicos
- Datas: `usePodeAlterarDatas` controla o bloqueio em `TarefaAgendaPanel`.
- Leitura: `NovaTarefaPublicacaoDialog` já grava `publicacoes_djen_leituras` (inclui duplicadas).
- Cores de situação: guardar no cadastro de situações por coordenação (campo de cor), sem afetar regras de acesso.
- Workflow: dados por etapa guardados na execução e aplicados na geração de cada item.

## Pendente
- Relatório do item 3.
