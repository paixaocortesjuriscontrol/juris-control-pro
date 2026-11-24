# Remanejamento mais completo

## Situação atual
Hoje, ao clicar em **Remanejar**, o painel lateral mostra uma tabela com Título, Processo, Responsáveis e as datas do tipo escolhido. Faltam o prazo fatal real em destaque, a hora, as observações, a descrição, as partes, os envolvidos, a situação e a coordenação. Sem isso, a equipe não consegue decidir o que pode ser reagendado.

## O que vou fazer
1. **Painel mais largo e organizado**, na mesma lateral direita: cabeçalho fixo, filtros em cartão, lista no meio e regras e confirmação no rodapé fixo.
2. **Cada linha mostra, de cara:**
   - Título e tipo (Tarefa, Prazo ou Ata, com a cor do tipo).
   - Processo e partes (ativo x passivo).
   - **Prazo fatal real** em destaque, com hora, e um selo de "vencido" ou "vence em X dias".
   - Data prevista ou limite, que é a data interna.
   - Situação e coordenação.
   - Responsáveis e envolvidos, com os nomes.
   - Uma linha curta com o começo da **observação** e da descrição.
3. **Ver detalhes:** clicar na seta da linha abre um bloco embaixo com a descrição completa, as observações completas, o último andamento, o prazo em dias (úteis ou corridos) e a data base. Clicar no restante da linha continua marcando a atividade.
4. **Ordenação e atalhos:** ordenar por prazo fatal, data prevista ou processo. Filtro rápido para "só com prazo fatal até…" e busca também nas observações.
5. **Resumo antes de aplicar:** quantos itens foram escolhidos, quantos têm prazo fatal antes da nova data (alerta em vermelho) e a lista desses itens.

Eventos e audiências ganham o mesmo nível de detalhe: local, hora, descrição e envolvidos.

## Detalhes técnicos
- `usePessoasEmLote.ts`: incluir `descricao, observacoes, descricao_ultimo_andamento, hora_fatal, hora_prevista, prazo_dias, prazo_unidade, partes_ativas, partes_passivas` nas tarefas, `descricao, local` nos eventos e `local, observacoes` nas audiências, se existirem. Os campos novos são opcionais em `ItemLote`, sem mudar a tela Pessoas em lote.
- `RemanejamentoTarefasSheet.tsx`: trocar a tabela por linhas em cartão com expansão. Nomes de responsáveis e envolvidos vêm da mesma busca de `profiles_basic`. Coordenação pelo nome em `useCoordenacoesDoUsuario`. O alerta "fatal antes da nova data" é calculado com `calculos`.
- Sem mudança no banco nem nas permissões.
