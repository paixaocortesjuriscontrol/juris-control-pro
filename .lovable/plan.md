# Validador da planilha "Exportar Atividade" (Painel de Controle)

## Objetivo
Dar à Dra. Janaina uma prova de que todos os prazos/tarefas que ela filtrou entraram na planilha.

## O que muda para o usuário
1. **Nova aba "Conferência" na planilha exportada**, com:
   - Filtros usados (período, tipos, situações, pessoas e papel, coordenação, referência vencimento/cadastro).
   - **Total encontrado no banco** com esses filtros, feito por uma contagem independente, sem passar pela agenda da tela.
   - **Total exportado** na planilha.
   - Resultado: "CONFERIDO – nada faltando" (verde) ou "ATENÇÃO – X itens faltando" (vermelho).
   - Se houver diferença, a lista dos itens faltantes (processo, título, tipo, situação, data limite, data fatal, responsáveis) e o motivo provável. Exemplo: filtro da tela ativo ou item recorrente agrupado.
2. **Aviso na tela ao terminar a exportação**: "Conferido: 152 de 152 prazos" ou "Faltaram 3 itens, veja a aba Conferência".
3. **Filtros escondidos da tela:** hoje a exportação também respeita os filtros do Painel (ex.: etiquetas, origem, busca). Quando houver algum desses filtros ligado, a aba Conferência e o aviso vão dizer qual era, para explicar a diferença.

## Detalhes técnicos
- Em `exportarAtividades` (`src/pages/PainelControle.tsx`), depois de montar `itensExport`, uma nova função `conferirExportacao` em `src/lib/conferenciaExportacao.ts`:
  - consulta direto `tarefas` (e `audiencias_detectadas`/`eventos_agenda` quando escolhidos) com período (limite OU fatal dentro, ou `created_at` em BRT), `status in`, coordenação; pessoas via `tarefa_responsaveis`/`tarefa_envolvidos` em lotes (`inChunks`), conforme o papel escolhido;
  - a RLS continua valendo (mesma sessão do usuário) e não muda nada no banco;
  - compara os IDs-base (sem sufixo de ocorrência) com os exportados e devolve `{totalBanco, totalExportado, faltantes[], extras[], filtrosTela[]}`.
- A aba é escrita pelo mesmo gerador da planilha, sem mexer nas abas e colunas atuais.
- Testes em `src/lib/conferenciaExportacao.test.ts`: período por limite/fatal, papel responsável x envolvido, recorrente contado uma vez, falta detectada.
- Não há mudança no banco nem nas permissões.
