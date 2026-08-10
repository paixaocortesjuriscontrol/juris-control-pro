# Menções com @ nos comentários

Permitir que o usuário logado mencione outro membro das suas coordenações digitando `@` no comentário, com lista automática de sugestões e envio de e-mail ao mencionado.

## Como vai funcionar

1. Ao digitar `@` na caixa de comentário (tarefas, prazos, eventos, audiências, parcelamentos), aparece uma lista suspensa com os membros das coordenações às quais o usuário logado pertence (Admin vê todos). A lista filtra conforme as letras digitadas depois do `@`.
2. Ao escolher um nome, o texto recebe `@Nome Sobrenome` e o usuário fica registrado como mencionado no comentário.
3. No comentário publicado, as menções aparecem destacadas (cor primária, negrito leve).
4. Cada pessoa mencionada recebe um e-mail com: quem mencionou, data/hora (BRT), título do item, coordenação, processo vinculado (quando houver), trecho do comentário e link direto para o item.
5. O e-mail de menção é enviado sempre, mesmo que a pessoa não seja responsável nem envolvida no item. Continua valendo a preferência individual de canal na Central de Notificações (quem desativou e-mail de comentários não recebe).
6. Quem se menciona a si mesmo não recebe e-mail; menções repetidas geram apenas um e-mail por pessoa.

## Detalhes técnicos

**Banco**
- Nova coluna `mencionados uuid[] default '{}'` em `comentarios_tarefas`, `comentarios_eventos` e `comentarios_audiencias`.
- Novo tipo de evento `mencao` na fila: o gatilho `enqueue_comentario` passa a inserir, além da linha de `comentario` (destinatários = responsáveis/envolvidos, excluindo mencionados para não duplicar), uma segunda linha em `notificacoes_fila` com `tipo_evento = 'mencao'` e `responsaveis = NEW.mencionados` (menos o autor).
- Ativar `mencao` em `config_alertas_coordenacao.tipos_alerta` por padrão, e tratar `mencao` como não filtrável pelo tipo de alerta da coordenação (a pessoa foi chamada diretamente).

**Frontend**
- Novo componente `src/components/comum/MencaoTextarea.tsx`: textarea com detecção do `@` (posição do caret), popover de sugestões navegável por teclado (setas/Enter/Esc), e callback com os IDs mencionados.
- Novo hook `src/hooks/useMembrosMencionaveis.ts`: reaproveita `useCoordenacoesDoUsuario` e busca membros via `membros_coordenacao` + `coordenacoes.coordenador_id`, resolvendo nomes em `profiles_basic`.
- `src/components/comum/ItemComentarios.tsx` e `src/components/prazos/TarefaComentarios.tsx`: trocar `Textarea` por `MencaoTextarea`, gravar `mencionados` no insert e renderizar o conteúdo com as menções destacadas.

**Edge Function**
- `supabase/functions/notificar-mudanca-situacao/index.ts`: reconhecer `tipo_evento = 'mencao'` com assunto e cabeçalho próprios ("Você foi mencionado em ..."), mapeando para o mesmo canal/preferência de comentário e registrando `tipo_alerta: 'mencao'` no histórico.
