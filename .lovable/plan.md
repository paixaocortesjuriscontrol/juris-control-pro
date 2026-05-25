# Botão "Ocultar duplicadas" na Análise DJEN

## Objetivo
Adicionar um botão toggle no topo da lista de publicações da página Análise DJEN que esconde visualmente publicações duplicadas (mesmo processo + mesmo conteúdo na mesma coordenação), mantendo apenas a mais completa. Sem alteração no banco — apenas filtro de tela, reversível com um clique.

## Mudanças

**`src/pages/AnaliseDjen.tsx`**
1. Novo estado `ocultarDuplicadas` (boolean, default `true` para já entregar a tela limpa).
2. Persistir a preferência em `localStorage` (`analise-djen:ocultar-duplicadas`) para o advogado não precisar reclicar a cada acesso.
3. Aplicar `dedupePublicacoesDjen` (já existente em `src/utils/djenDedup.ts`) sobre a lista **após** os filtros atuais (coordenação, data, termo, lida/não-lida, tipo). Assim o escopo respeita exatamente o que está visível.
4. Botão na barra de ações da lista, ao lado dos filtros existentes:
   - Ícone `Layers` + texto "Ocultar duplicadas" / "Mostrar duplicadas"
   - Badge mostrando quantas foram ocultadas (ex.: "23 ocultas")
   - Tooltip explicando o critério (mesmo processo + conteúdo na coordenação)
5. Contadores de "não lidas" / "total" exibidos no header passam a refletir a lista deduplicada quando o toggle está ativo (consistência visual).

## Detalhes técnicos

- A função `dedupePublicacoesDjen` já preserva o registro com conteúdo mais completo e respeita `id_djen` quando presente — não precisa duplicar lógica.
- O filtro é puro client-side dentro do `useMemo` que já produz a lista renderizada; não dispara refetch nem invalida queries.
- Geração de PDF/resumo IA continua usando a base completa filtrada (não muda); apenas a renderização da tabela é afetada.
- Nenhuma alteração em hooks, edge functions, RLS ou schema.