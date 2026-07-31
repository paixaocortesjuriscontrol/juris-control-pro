# Deixar a etiqueta visível e fácil de aplicar

## Situação atual

A etiqueta "Verificar Kurier" foi criada na coordenação "Kurier - paixaoc.02 - Somente Kurier", está ativa e habilitada nos quatro módulos (Processos, Itens, Clientes, Publicações). Ou seja: ela já pode ser aplicada — o problema é que o ponto de clique está praticamente invisível.

Hoje, na Análise DJEN, o acesso é aquele texto cinza minúsculo "Etiqueta" com ícone ao lado da data (aparece no print). Ele abre o painel de seleção, mas não parece um botão e se perde entre os selos coloridos da linha.

## O que será feito

1. Transformar o acesso às etiquetas em um botão de verdade
   - Botão pequeno com contorno, ícone de etiqueta e rótulo "Etiqueta" (ou "Etiquetas (n)" quando já houver alguma aplicada), no mesmo padrão visual dos outros botões da linha (Importar, Adicionar, Lida, Descartar).
   - Quando houver etiquetas aplicadas, elas continuam aparecendo como selos coloridos, com o botão ao lado para editar.
   - Vale para todas as telas que usam o seletor: Análise DJEN, Processos e Casos, Clientes e Lista de Atividades.

2. Melhorar o painel que abre
   - Título "Aplicar etiqueta" e indicação da coordenação cujas etiquetas estão sendo listadas.
   - Quando a coordenação do item não tiver etiqueta cadastrada para aquele módulo, mensagem clara com atalho para a tela Etiquetas.

3. Colocar o botão também no formulário de cada item
   - Nos formulários abertos pelo botão Adicionar (tarefa, prazo, evento, audiência, parcelamento) e no detalhe do processo, incluir o mesmo botão de etiquetas, para não depender apenas da linha da lista.

## Detalhes técnicos

- `src/components/etiquetas/EtiquetaPicker.tsx`: trocar o gatilho por `Button variant="outline" size="sm"`, com contagem, e ajustar cabeçalho/estado vazio do `PopoverContent`.
- `src/pages/AnaliseDjen.tsx`: reposicionar o picker na barra de ações da publicação (junto de Importar/Adicionar/Lida/Descartar) em vez da linha da data.
- `src/pages/Processos.tsx`, `src/pages/Clientes.tsx`, `src/components/lista/ListaAtividadesView.tsx`, `src/components/processos/ProcessoExpandableRow.tsx`: sem mudança de lógica, apenas herdam o novo gatilho.
- Formulários (`PrazoDialog`, `EventoDialog`, `NovaTarefaDialog`, `EditarAudienciaDialog`, `GerarParcelasDialog`): incluir `EtiquetaPicker` com a entidade correspondente, habilitado somente quando o item já existe (id salvo).
- Sem mudanças de banco: tabelas `etiquetas` e `etiquetas_itens` e as regras de acesso por coordenação continuam iguais.