# Barra de rolagem no painel "Iniciar Workflow"

## Problema
O painel lateral "Iniciar Workflow" (aberto pelo Painel de Controle) cortava as etapas e o botão de criar, sem permitir rolar. O painel lateral corta tudo o que passa da altura e espera que cada conteúdo tenha a própria rolagem. A tela de workflow, quando aparece dentro do painel, não tinha essa rolagem, e com a nova lista de etapas ficou maior que a tela.

## Correção
- Em `src/components/workflow/IniciarWorkflowDialog.tsx`, no modo dentro do painel (`inline`), trocar o invólucro `p-4` por `h-full min-h-0 overflow-y-auto p-4`.
- Não mexer no painel lateral compartilhado, para não mudar as outras janelas (tarefa, prazo, evento), que já rolam sozinhas.

## Verificação
- Build OK; conferir que a janela comum de workflow (fora do painel) continua igual.
