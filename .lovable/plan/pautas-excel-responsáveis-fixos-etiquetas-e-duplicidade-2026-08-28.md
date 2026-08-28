# Pautas Excel: responsáveis fixos, etiquetas e duplicidade

## Diagnóstico da importação da Jéssica

Consultei o banco: a Jéssica importou **25 audiências** em 27/08 às 19:54–19:55 (Brasília), na Coordenação Dra. Beatriz Costa, e **nenhuma delas tem etiqueta vinculada**. Nenhuma etiqueta nova foi criada nesse horário (as da coordenação são todas de 04/08). Ou seja: subiu sem etiquetas — o suporte à coluna ETIQUETA já existe no código, mas a tela dela estava com a versão antiga em cache.

## 1) Responsáveis e envolvidos fixos da coordenação

Hoje o diálogo de Pautas Excel só vincula quem é escolhido manualmente em "Responsáveis pelas audiências". Vou fazer o mesmo que os formulários do botão Adicionar:

- Ao abrir o diálogo, pré-carregar os **responsáveis e envolvidos fixos do tipo "Audiência"** da coordenação (Beatriz Costa como envolvida, Mayara como responsável, etc.), já marcados e editáveis.
- Na importação, gravar os responsáveis em `audiencias_advogados` e os envolvidos em `audiencia_envolvidos` para cada audiência criada.
- Aviso na tela deixando claro que os fixos da coordenação foram aplicados.

## 2) Novo modo "Aplicar etiquetas"

Nova aba/opção no próprio diálogo Pautas Excel: **"Somente aplicar etiquetas (não criar itens)"**.

- Sobe a mesma planilha; o sistema casa cada linha com a audiência já existente (mesma coordenação, mesmo processo, mesmo dia) e aplica **a etiqueta da coluna ETIQUETA daquela linha** (item 4). Etiqueta que não existe no catálogo da coordenação é criada automaticamente.
- Opcionalmente, uma etiqueta escolhida na tela pode ser aplicada a todas as linhas — mas o padrão é usar a coluna da planilha.
- Prévia por linha: audiência encontrada / não encontrada, etiqueta a aplicar, se ela já existe e se já está aplicada. Nada é criado, alterado ou duplicado além do vínculo de etiqueta.
- Resumo final: etiquetas aplicadas, etiquetas criadas, linhas sem audiência correspondente, com exportação CSV.

Isso resolve retroativamente as 25 audiências da Jéssica: ela (ou você) sobe a mesma planilha nesse modo e as etiquetas entram.

## 3) Prévia mostrando 15 audiências "novas" na mesma planilha

A checagem de duplicidade compara processo + data + título, mas hoje ela tem duas falhas que explicam linhas reaparecendo como novas:

- A consulta de itens existentes não trata o **limite de 1000 linhas** do Supabase: com 135 processos, audiências/tarefas/eventos podem passar disso e as chaves faltantes viram "nova".
- Linhas cujo processo ainda não existe na base **nunca** geram chave e são sempre marcadas como novas, mesmo que a audiência já tenha sido criada na importação anterior (o processo passa a existir só depois).
- O título comparado é o tipo da planilha; variações de caixa/acentos/espaços na coluna TIPO fazem a chave não casar.

Correções: paginar as consultas de duplicidade em blocos (sem estourar 1000), reconsultar por **número do processo** (dígitos) além do `processo_id`, e normalizar o título na chave (maiúsculas, sem acento, espaços colapsados). Depois disso, reimportar a mesma planilha deve resultar em 0 audiências a criar.

## Detalhes técnicos

- `src/components/coordenacoes/PautasExcelDialog.tsx`: usar `useFixosDoTipoCoordenacao(coordenacaoId, "audiencia")` para pré-selecionar responsáveis/envolvidos; inserir em `audiencia_envolvidos`; novo estado `modo: "importar" | "etiquetas"`; no modo etiquetas, pular criação de processo/audiência e apenas resolver etiqueta + upsert em `etiquetas_itens` (`onConflict: etiqueta_id,entidade,entidade_id`).
- Casamento no modo etiquetas: `audiencias_detectadas` filtrada por `coordenacao_id` + `processo_numero` (dígitos) + faixa do dia da audiência; múltiplas no mesmo dia recebem a etiqueta e são sinalizadas na prévia.
- Duplicidade: helper de paginação (`range` em páginas de 1000) para `audiencias_detectadas`, `tarefas` e `eventos_agenda`; chave `digits|YYYY-MM-DD|tituloNormalizado`.
- `await invalidateQueries` (`etiquetas`, `etiquetas-itens`, agenda) antes de fechar o diálogo. Sem mudanças de schema.
