# Busca do Painel de Controle no modo Lista

## O que muda

1. **Buscar em todos os campos do item.** Hoje a pesquisa por palavra olha apenas: título, descrição, observações, tipo de tarefa, tipo de evento, local, órgão, número do processo e nome do responsável. Passa a olhar todo o conteúdo de texto do item — por exemplo prioridade, situação, partes ativas e passivas, fórum, sala, modalidade, tipo de audiência, link/local, identificador de origem, nomes dos envolvidos e o número/assunto do processo ligado ao item. Vale para tarefas, prazos, audiências, eventos e parcelamentos.

2. **Sem filtro preenchido, busca em tudo.** No modo Lista, quando nenhum filtro de data está preenchido, a pesquisa varre todo o histórico (já é assim hoje) — a mudança é que ela também deixa de ficar presa ao mês exibido quando o usuário só digitou a palavra, sem escolher período, classificação, situação ou responsável.

3. **Sempre dentro das coordenações do usuário.** A busca ampliada continua usando exatamente o mesmo recorte de acesso da tela: coordenações a que o usuário pertence (e, para o administrador, o recorte escolhido no seletor de coordenação). Nada de outra equipe aparece na pesquisa.

## Detalhes técnicos

- `src/pages/PainelControle.tsx`, dentro de `passaFiltrosPainel`: trocar a lista fixa `alvo` por um coletor genérico de texto do item.
  - Nova função utilitária `textoBuscavelItem(item)`: percorre as chaves do objeto e concatena valores `string`/`number`, ignorando chaves técnicas (`id`, `*_id`, `*_ids`, `created_at`, `updated_at`, `origem`, `recorrencia_rrule`) e campos de data puros; desce um nível em `processo` (número, assunto), `responsavel` (nome), `participantes[].nome`/`usuario_nome`, `responsaveis_nomes` e arrays de string (`partes_ativas`, `partes_passivas`).
  - Normalizar com remoção de acentos nos dois lados (termo e alvo) para que "audiencia" encontre "audiência"; manter a regra atual de exigir todas as palavras.
  - Memoizar por item com um `WeakMap` para não recalcular o texto a cada render da lista.
- Busca global (`buscaGlobalAtiva` / `buscaGlobalQuery`): manter `viewMode === "lista"` e a ausência de `periodoInicio`/`periodoFim`; continua reaproveitando `filters` (que já carrega `coordenacaoIds`, `coordenacaoId` do admin e `responsavelIds`), portanto o escopo por coordenação é preservado sem mudança.
- Nenhuma alteração de banco, hooks de dados ou regras de negócio.
