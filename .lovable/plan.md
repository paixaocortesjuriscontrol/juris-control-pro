# Marca de "já cobrei" nos itens do Painel de Controle

## O que a Jessica quer

Percorrer os prazos do dia um por um, cobrar, comentar e deixar uma marca visível
no item — para saber, de bater o olho, quais já foram cobrados e qual é o próximo.

## Como vai funcionar

1. **Marca visível na linha do item** (Lista, Calendário e Equipe do Painel de Controle):
   uma bolinha com a letra escolhida (por padrão **C**, de cobrado), ao lado dos
   selinhos que já existem (atividade, comentário, workflow).
2. **A marca fica permanente** e mostra na dica de tela a data/hora da última
   cobrança (BRT) e quem cobrou. Cobranças novas atualizam a data; o histórico de
   todas as cobranças fica guardado.
3. **Cor por recência**, para o dia a dia não confundir:
   - cobrado hoje: bolinha cheia (destaque);
   - cobrado antes de hoje: bolinha apagada, com a data na dica.
4. **Duas formas de marcar**:
   - automaticamente, ao enviar um comentário com a caixinha "cobrança" marcada
     (a que já existe no comentário do item);
   - manualmente, num botão de um clique na linha do item e no formulário do item
     (clicar de novo desfaz a marca do dia).
5. **Escolha do símbolo**: no próprio botão, uma listinha de símbolos para escolher
   (C, ✅, 📣, ⚠️, 👍, ⏰ …). A escolha é gravada na cobrança, então a marca aparece
   com o símbolo que a pessoa usou.
6. **Pessoal ou da equipe**: um seletor no topo do Painel de Controle — "Minhas
   cobranças" (padrão) ou "Da equipe" (mostra também as cobranças dos colegas,
   com o nome de quem cobrou na dica).
7. **Filtro rápido**: botões "Já cobrados hoje" / "Ainda não cobrados hoje" para
   isolar o que falta percorrer.

## Detalhes técnicos

- Nova tabela `item_cobrancas`: `id`, `tipo_item` (tarefa/prazo/evento/audiencia),
  `item_id`, `usuario_id`, `simbolo`, `comentario_id` (quando vier de comentário),
  `created_at`. Índices por `item_id` e por `usuario_id, created_at`.
  GRANTs para `authenticated`/`service_role` + RLS: leitura para usuários das
  coordenações do item (mesmo padrão dos comentários), insert/delete somente do
  próprio registro.
- Hook `useItensComCobrancas(itemIds, escopo)` agregando última cobrança por item
  (mesma abordagem de `useItensComComentarios`), com `queryKey` incluída em
  `CHAVES_ITENS_AGENDA` para invalidar junto com o resto.
- Componente `CobrancaBadge` + `CobrancaBotao` (popover de símbolos) em
  `src/components/comum/`.
- `ItemComentarios`: ao enviar com `is_cobranca`, grava também a cobrança e
  invalida as queries (await antes do sucesso, conforme padrão do projeto).
- `PainelControle.tsx`: renderiza o selinho nas linhas de item, adiciona o seletor
  Minhas/Equipe e os dois filtros; `ListaAtividadesView` e a visão Equipe recebem
  o mesmo selinho.
- Preferência de símbolo padrão e escopo salvos em `localStorage` por usuário.
