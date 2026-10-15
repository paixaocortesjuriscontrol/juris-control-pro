# App mobile profissional do JurisControl (instalável)

O sistema passa a poder ser instalado na tela inicial do iPhone e Android, com ícone próprio, abrindo em tela cheia como um aplicativo, e todas as telas ficam confortáveis no celular.

## Etapa 1 — Instalação no celular
- Ícone do JurisControl (azul-marinho e dourado) em todos os tamanhos exigidos.
- Abre em tela cheia, sem barra do navegador, com cor do tema na barra do celular.
- Nome na tela inicial: "JurisControl".
- Sem modo offline (precisa de internet, como hoje) e sem notificações no celular por enquanto.

## Etapa 2 — Estrutura geral no celular
- Menu lateral vira gaveta com botão no topo; barra inferior fixa com atalhos: Painel, Processos, DJEN, Pautas, Menu.
- Cabeçalho compacto; janelas e painéis laterais abrem em tela cheia.
- Botões e campos com tamanho adequado ao toque.

## Etapa 3 — Telas prioritárias (adaptação completa)
- Painel de Controle: agenda em lista por dia, Kanban com rolagem lateral por coluna, baixa de itens com um toque.
- Processos e Casos: lista em cartões em vez de tabela; ficha do processo com abas roláveis e "Adicionar" em tela cheia.
- Análise DJEN: publicação em cartão, ações (ler, descartar, criar item) em barra fixa.
- Pautas de Julgamento: cartões de pauta, filtros em gaveta, formulário com Salvar fixo.

## Etapa 4 — Demais telas
- Tabelas largas viram cartões ou ganham rolagem horizontal; filtros em gaveta.
- Telas pesadas de administração/importação (Migração Projuris, Carga Benner, planilhas) ficam funcionais, com aviso de que são mais indicadas no computador.

## Entrega
Feita em partes, nessa ordem, com versão nova no menu ao fim de cada etapa. Após publicar: no iPhone, Safari → Compartilhar → Adicionar à Tela de Início; no Android, menu do Chrome → Instalar app.

## Detalhes técnicos
- Manifest em `public/manifest.webmanifest` + ícones em `public/` + tags em `index.html` (theme-color, apple-touch-icon, apple-mobile-web-app). Sem service worker nem vite-plugin-pwa.
- `MainLayout` ganha `MobileBottomNav` (usa `useIsMobile` e `useMenuPermissions`), safe-area (`env(safe-area-inset-*)`).
- Padrão reutilizável `ResponsiveTable` (tabela no desktop, cartões no mobile) e `Sheet`/`Drawer` em tela cheia abaixo de 768px.
- Nenhuma mudança de banco, regras ou permissões.
