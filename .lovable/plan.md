# Proposta: Modo Lista mais organizado

## Problema hoje
A primeira coluna ("Atividade") acumula tudo: número do processo, tipo, título, ícones (comentário, anexo, cobrança), etiquetas, assunto, reclamante e reclamada. Fica alta, apertada e difícil de ler. As datas também ocupam muito espaço (Limite, Fatal, Base, Publicação empilhados).

## Proposta: cada atividade em 2 linhas

```text
┌───┬──────────────────────────────┬──────────────┬──────────┬──────────┬──────────┬───────────┬────────┬───────┐
│ ☐ │ PROCESSO 0001234-56... [Prazo]│ Observação   │ Respons. │ Limite   │ Fatal    │ Prioridade│ Status │ Ações │
│   │ TÍTULO DA ATIVIDADE  💬 📎 🔔 │ (1ª linha)   │          │ 20/11    │ 25/11    │           │        │       │
├───┴──────────────────────────────┴──────────────┴──────────┴──────────┴──────────┴───────────┴────────┴───────┤
│   Assunto · Reclamante: Fulano x Reclamada: Banco · Local/Órgão · Etiquetas │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Linha 1 (principal), o que precisa ser feito:**
- No topo da primeira coluna, o **número do processo** (clicável) com o tipo (Tarefa, Prazo, Ata, Audiência) ao lado; logo abaixo, o título em destaque com os ícones.
- Observação (1ª linha), Responsável, Prioridade, Status e Ações, como hoje.
- Datas em colunas próprias e mais estreitas: **Limite** e **Fatal**. Base e Publicação passam para a linha 2.

**Linha 2 (detalhes do processo), em fundo levemente acinzentado e letra menor, ocupando toda a largura:**
- Assunto, "Reclamante x Reclamada", local/órgão (ou os detalhes da audiência), data base, publicação e etiquetas.
- Se a atividade não tiver processo, a linha 2 mostra só o que existir (ou some).

## Ganhos
- O título fica fácil de achar, sem disputar espaço com as partes.
- As colunas ficam alinhadas e mais estreitas, com a cara de uma planilha profissional.
- Vê-se mais atividades por tela, porque a primeira coluna deixa de ficar muito alta.
- Separação visual clara entre uma atividade e a próxima (linha 2 com fundo suave e borda inferior).

## Opcional (posso incluir se quiser)
- Botão "Compacto / Detalhado" no topo da lista: o compacto esconde a linha 2.
- Agrupar por processo: várias atividades do mesmo processo sob um único cabeçalho.

## O que não muda
- Filtros, seleção em lote, ordenação, clique para abrir, cores de situação, risquinho e V verde dos tratados.
- Excel e demais telas.

## Detalhes técnicos
- Arquivo: `src/components/lista/ListaAtividadesView.tsx`. Cada item vira dois `TableRow` (principal + detalhe com `colSpan` total); o hover e o clique valem para os dois.
- Novas colunas "Limite" e "Fatal"; a coluna "Local / Parte" sai e o conteúdo vai para a linha de detalhe.
- Ordenação por data mantém o cabeçalho atual, apenas na coluna Limite.
