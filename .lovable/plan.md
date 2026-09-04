# Padrão visual administrativo na lista de Processos e Casos

O novo visual (cantos retos, rótulos curtos em maiúsculas, cartões com faixa de título fina) já está aplicado na ficha de um processo. Este plano leva o mesmo padrão para a tela de lista de Processos e Casos, sem mudar nenhum comportamento.

## Por que você não viu no preview

Você estava no Painel de Controle. O redesenho vale dentro da ficha do processo: em Processos e Casos, clique num processo e depois em "Abrir processo".

## O que muda na lista

- Barra de filtros com cantos retos e borda fina, no lugar do bloco arredondado atual.
- Título e contagem de processos no topo com a mesma tipografia institucional da ficha.
- Cada linha de processo com cantos retos, separadores finos e destaque de seleção por barra lateral em vez de fundo arredondado.
- Blocos internos que aparecem ao expandir uma linha (prazos, audiências, tarefas, publicações) com o mesmo tratamento reto e denso.
- Etiquetas e contadores mantêm as cores atuais, apenas em formato retangular.

## O que não muda

- Nenhum filtro, botão, coluna, contagem ou ação é removido, renomeado ou reordenado.
- Seleção múltipla, geração de documentos, exportações e a abertura do painel lateral continuam iguais.
- Nada muda no banco de dados nem nas regras de negócio.

## Detalhes técnicos

- Aplicar a classe de escopo `processo-chrome` (já criada em `src/index.css`) no container da página `src/pages/Processos.tsx`, para neutralizar raios de canto apenas nessa tela.
- Trocar `rounded-xl` da barra de filtros por borda reta; ajustar `rounded-lg` dos blocos em `src/components/processos/ProcessoExpandableRow.tsx` (linhas 606, 664, 713, 785, 858) e o avatar da linha 524.
- Padronizar rótulos internos em `text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground`, igual ao cabeçalho da ficha.
- Manter tokens semânticos do design system (`bg-card`, `border-border`, `text-muted-foreground`, `bg-sidebar`); sem cores fixas.
- Validar com `npx tsgo --noEmit -p tsconfig.app.json` e conferir o log de build.
