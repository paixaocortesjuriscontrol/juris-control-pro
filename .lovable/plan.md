## Objetivo

Na tela **Análise DJEN**, ao abrir uma publicação para criar Prazo/Evento/Tarefa/Audiência, o usuário passa a poder alternar o tipo de item **sem fechar a tela**, e vê um card verde acima da publicação com o resumo de tudo que já foi criado a partir daquela publicação (inclusive o item recém-salvo). Também ganha um botão **Salvar e fechar** ao lado do **Salvar**.

Nada muda no Painel de Controle e nas demais telas — as alterações ficam restritas à Análise DJEN e a props opcionais nos diálogos.

## Mudanças de UI

### 1. Card verde "Itens criados a partir desta publicação" (acima da publicação)

Novo componente `src/components/shared/ItensCriadosPublicacaoCard.tsx`. Renderizado no topo do split view (acima do `PublicacaoSidePanel` + formulário), sempre que houver `selectedPublicacao` e o form inline estiver aberto.

Conteúdo:
- Cabeçalho verde ("Itens já criados a partir desta publicação") com o nº do processo e data.
- Lista os registros vinculados à publicação, buscando em paralelo:
  - **Tarefas**: `tarefas_publicacoes_djen` (para termo, via `ln = publicacao.id`) e `tarefas_publicacoes_djen_processos` (para processo).
  - **Prazos**: `prazos` filtrado por `publicacao_djen_id = publicacao.id` ou análogo (mesmo critério já usado em `PrazoDialog` para vincular).
  - **Eventos**: `eventos_agenda` filtrado pelo mesmo campo de vínculo usado em `EventoDialog`.
  - **Audiências**: `audiencias` filtrado pelo mesmo vínculo usado em `NovaAudienciaPublicacaoDialog`.
- Cada linha mostra ícone do tipo, título/resumo, data limite (quando existir) e link para abrir a tela original.
- Card retrátil (Collapsible) começando **aberto** quando um item acabou de ser criado (via prop `highlightId`), destacando por 3s o item recém-adicionado.

Se não houver nenhum item vinculado, o card não é exibido (evita ruído).

### 2. Botão "Adicionar" (seletor de tipo) acima do formulário

Dentro do painel direito do split view em `src/pages/AnaliseDjen.tsx`, acima do `EventoDialog`/`PrazoDialog`/`NovaTarefaPublicacaoDialog`/`NovaAudienciaPublicacaoDialog`, um `DropdownMenu` **"+ Adicionar"** com as mesmas opções já existentes na lista (Tarefa, Prazo, Evento, Audiência).

Ao selecionar outro tipo, alterna os `useState` de forma exclusiva (desliga o atual, liga o novo) mantendo `selectedPublicacao` e `adicionarProcessoId`. O layout side-by-side não é desmontado — apenas o formulário à direita troca. O botão "Voltar para a lista" continua no cabeçalho.

Reaproveita o handler `handleAdicionarClick` existente para reidratar `adicionarProcessoId/Numero` (idempotente para a mesma publicação).

### 3. Botão "Salvar e fechar" ao lado do "Salvar"

Nos diálogos `PrazoDialog` e `EventoDialog` já existe a prop `secondarySave` (hoje usada para "Salvar e ler"). Adicionar suporte a um **terceiro** botão via nova prop opcional `tertiarySave?: { label: string; onAfterSuccess?: () => void | Promise<void> }`, renderizado ao lado dos demais no footer, apenas quando `inline` é `true`.

Em `AnaliseDjen.tsx`, passar:
```ts
tertiarySave={{ label: "Salvar e fechar", onAfterSuccess: fecharTudo }}
```
para `PrazoDialog` e `EventoDialog`. Nos diálogos de Tarefa/Audiência, aplicar o mesmo padrão se já expuserem `secondarySave`; caso contrário, adicionar prop equivalente.

Comportamento do **Salvar** padrão (sem "e fechar"): mantém o formulário aberto e o **reseta** para novo cadastro do mesmo tipo, disparando invalidateQueries do card verde para refletir o item recém-criado (com `highlightId` = id retornado).

## Mudanças de arquivos

- `src/components/shared/ItensCriadosPublicacaoCard.tsx` — novo componente (verde, retrátil, uma linha por item vinculado).
- `src/pages/AnaliseDjen.tsx`
  - Renderizar `<ItensCriadosPublicacaoCard>` no topo do split view.
  - Renderizar o `DropdownMenu` "Adicionar" acima do formulário no painel direito.
  - Passar `tertiarySave={{ label: "Salvar e fechar", onAfterSuccess: fecharTudo }}` aos diálogos inline.
  - Callback `onAfterCreate(itemId, tipo)` para atualizar `highlightId` do card verde e resetar o form.
- `src/components/prazos/PrazoDialog.tsx` e `src/components/agenda/EventoDialog.tsx`
  - Nova prop `tertiarySave?: { label; onAfterSuccess? }`.
  - Nova prop `onAfterCreate?: (id: string) => void` já disparada no fluxo de sucesso do Salvar principal (não fecha; reseta form).
- `src/components/tarefas/NovaTarefaPublicacaoDialog.tsx` e `src/components/audiencias/NovaAudienciaPublicacaoDialog.tsx` (se necessário) — mesmas props opcionais, sem alterar comportamento fora do inline.

Nenhuma alteração no `PublicacaoVinculadaCollapsible` (continua sendo o card verde retrátil do Painel de Controle).

## Ponto que preciso confirmar

Você mencionou "esse card já existia, com tudo que foi criado para esta publicação". Procurei no código e o único card verde retrátil existente é o `PublicacaoVinculadaCollapsible`, que mostra a **própria publicação** — não os itens criados a partir dela. Se você lembra desse card em outra tela específica (ex.: Painel de Controle, Processo, algum diálogo), me diga onde para eu reaproveitar exatamente o mesmo componente em vez de criar `ItensCriadosPublicacaoCard` do zero.
