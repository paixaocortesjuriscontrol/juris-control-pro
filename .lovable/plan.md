# Coordenações: cargo confiável e painel lateral

## Objetivo
Corrigir a alteração de cargo da Lienne na coordenação Dra. Renata Oficial e modernizar a tela de Coordenações, mantendo a identidade navy e dourado, tipografia jurídica clássica e uma grade compacta.

## Mudanças

### Troca de cargo
- Padronizar os cargos gravados em `membros_coordenacao` pelos identificadores já usados no restante do sistema (`coordenador`, `assistente_coordenador`, `advogado`, etc.), exibindo os nomes legíveis na tela.
- Salvar o cargo pelo vínculo exato do membro com a coordenação e aguardar a atualização dos dados antes de encerrar a edição.
- Confirmar que o valor retornado pelo banco é o novo cargo; em caso contrário, mostrar erro em vez de uma confirmação incorreta.
- Manter a alteração restrita ao cargo dentro da coordenação, sem modificar automaticamente o perfil geral do usuário nem o coordenador titular da coordenação.

### Nova tela de Coordenações
- Usar toda a largura útil para uma grade de cartões: 1 coluna no celular, 2 em telas médias, 3 em desktop e 4 em telas largas.
- Deixar cada cartão mais compacto, com nome, área, coordenador titular, total de membros, processos e pendências.
- Ao clicar em um cartão, abrir um painel sobreposto pela direita, mantendo a grade visível ao fundo.
- Levar para o painel lateral os dados da coordenação, membros, edição direta de cargo e todas as ações já existentes.
- Organizar as muitas ações em grupos claros para reduzir poluição visual, sem remover funções.
- Preservar os diálogos existentes de adicionar membro, distribuir, transferir, relatórios, permissões e demais configurações.

## Direção visual
- Cores: navy e dourado já definidos no sistema.
- Tipografia: títulos jurídicos clássicos e texto de alta legibilidade, respeitando as fontes existentes do produto.
- Cartões compactos, cantos discretos, hierarquia forte e animações leves.
- O painel lateral terá largura confortável no desktop e ocupará quase toda a tela no celular.

## Validação
- Conferir que trocar o cargo para Coordenador persiste após atualizar a lista.
- Conferir grade em tamanhos desktop e celular, abertura/fechamento do painel e ausência de sobreposição de textos.
- Validar que todas as ações antigas continuam acessíveis.
- Conferir o resultado do build e erros de execução disponíveis.
