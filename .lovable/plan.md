# Etiquetas da importação da Jéssica: diagnóstico e correção

## O que os dados mostram

Consultei o banco:

- A Jéssica Alves importou **25 audiências** pela planilha de pautas em 27/08/2026 às 19:54–19:55 (horário de Brasília), todas na Coordenação Dra. Beatriz Costa.
- **Nenhuma dessas 25 audiências tem etiqueta vinculada** (zero registros em `etiquetas_itens`).
- Nenhuma etiqueta nova foi criada nesse horário — as etiquetas da coordenação são todas de 04/08. Ou seja, a coluna ETIQUETA não foi processada nessa importação (versão antiga carregada no navegador dela, ou coluna ausente/vazia na planilha enviada).

Conclusão: a importação subiu **sem** as etiquetas, como você suspeitava. Os dados das audiências em si estão corretos; falta apenas o vínculo das etiquetas.

## Como corrigir

Modo "Aplicar etiquetas" no diálogo de Importar Pautas Excel:

- Nova opção no diálogo: **"Somente aplicar etiquetas (não criar itens)"**.
- Ao subir a mesma planilha nesse modo, o sistema casa cada linha com a audiência já existente (mesmo processo + mesma data + mesma coordenação) e aplica apenas a etiqueta da coluna ETIQUETA, criando a etiqueta na coordenação caso ainda não exista.
- A prévia mostra, por linha: audiência encontrada / não encontrada, etiqueta a aplicar e se ela já existe no catálogo. Nada é criado ou duplicado.
- Ao final, resumo com quantas etiquetas foram aplicadas, quantas linhas não encontraram audiência e exportação CSV dos casos não resolvidos.

Também vou reforçar a prévia da importação normal com um aviso quando a planilha não tiver a coluna ETIQUETA reconhecida, para o problema não passar batido.

## Detalhes técnicos

- `src/components/coordenacoes/PautasExcelDialog.tsx`: flag `modoSomenteEtiquetas`; quando ativa, pula criação de processo/audiência/tarefa/evento e executa apenas a resolução de etiqueta + `etiquetas_itens` (insert idempotente por `etiqueta_id + entidade + entidade_id`).
- Casamento da linha com a audiência: busca em `audiencias_detectadas` por `coordenacao_id`, `processo_numero` (dígitos) e data do dia da audiência; múltiplos resultados no mesmo dia são etiquetados todos e sinalizados na prévia.
- Reuso do resolvedor de etiquetas já existente (busca por nome normalizado em `etiquetas` da coordenação, criação com `modulos` padrão quando ausente) e de `useToggleEtiquetaItem`/insert direto conforme o padrão atual do arquivo.
- `src/lib/pautasExcelParser.ts`: expor no resultado se a coluna ETIQUETA foi localizada no cabeçalho, para o aviso na prévia.
- Nenhuma alteração de schema; `await invalidateQueries` antes de fechar o diálogo.
