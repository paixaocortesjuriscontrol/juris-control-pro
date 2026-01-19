# Memory: style/process-details-layout-optimization-v1-pt-br
Updated: 2026-01-19

A página de detalhes do processo utiliza um layout de sidebar vertical na esquerda para navegação entre abas (Audiências, Intimações, Tarefas, etc.) no desktop, que se torna um scroll horizontal no mobile. O conteúdo da aba selecionada é renderizado dinamicamente dentro do 'ProcessoResumoCard' na coluna da direita.

## Layout das abas compacto
As abas (Audiências, Intimações, Tarefas) usam um layout compacto e profissional:
- Container com max-w-md (~50% da tela) para evitar ocupar todo o espaço
- Espaçamento reduzido (space-y-2, p-2) para lista mais densa
- Fontes menores (text-xs, text-sm) consistentes com listas
- Bordas simples (border rounded) em vez de Cards pesados
- Header com ícone pequeno (w-4 h-4) e título em text-sm font-medium
- Botões compactos (h-7 px-2 text-xs) para ações

Dados informativos (Data de Distribuição, Órgão Julgador, Área, Fase, etc.) foram movidos para a coluna da esquerda, abaixo do nome da Pasta e da Descrição, otimizando o espaço. O nome da Pasta (preferencialmente 'pasta_cliente') é exibido em destaque ao lado do botão 'Mais informações', sem o rótulo 'PASTA:', e o cabeçalho negrito com o nome do cliente foi removido para uma estética mais limpa.
