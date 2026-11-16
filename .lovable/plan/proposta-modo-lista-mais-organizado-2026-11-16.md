# Proposta: Modo Lista mais organizado

## Problema hoje
A primeira coluna ("Atividade") acumula tudo: número do processo, tipo, título, ícones, etiquetas, assunto, reclamante e reclamada. Fica alta, apertada e difícil de ler. As datas também ocupam muito espaço (Limite, Fatal, Base e Publicação empilhados).

## Proposta: cada atividade em 3 linhas

```text
┌───┬───────────────────────────────────┬──────────┬─────────┬─────────┬───────────┬────────┬───────┐
│ ☐ │ PROCESSO 0001234-56...   [Prazo]  │ Respons. │ Limite  │ Fatal   │ Prioridade│ Status │ Ações │
│   │ TÍTULO DA ATIVIDADE  💬 📎 🔔      │          │ 20/11   │ 25/11   │           │        │       │
├───┴───────────────────────────────────┴──────────┴─────────┴─────────┴───────────┴────────┴───────┤
│   Assunto · Reclamante: Fulano x Reclamada: Banco · Local/Órgão · Base · Publicação · Etiquetas     │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│   Observação: primeira linha da observação (texto completo ao passar o mouse)                      │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Linha 1 (principal):**
- No topo da primeira coluna, o **número do processo** (clicável) com o tipo (Tarefa, Prazo, Ata, Audiência) ao lado. Logo abaixo, o título em destaque com os ícones.
- Responsável, Prioridade, Status e Ações, como hoje.
- Datas em colunas próprias e mais estreitas: **Limite** e **Fatal**.

**Linha 2 (detalhes), em letra menor, ocupando toda a largura:**
- Assunto, "Reclamante x Reclamada", local/órgão (ou os detalhes da audiência), data base, publicação e etiquetas.

**Linha 3 (observação), abaixo do assunto:**
- A primeira linha da observação, ocupando toda a largura. Ao passar o mouse, aparece o texto completo.
- A coluna "Observação" separada deixa de existir.

As linhas 2 e 3 só aparecem quando há conteúdo. Uma borda separa cada atividade da próxima.

## Ganhos
- O processo e o título ficam fáceis de achar.
- A observação ganha a largura toda, como no Projuris.
- As colunas ficam alinhadas e mais estreitas, com aparência mais profissional.

## Opcional (posso incluir se quiser)
- Botão "Compacto / Detalhado": o compacto esconde as linhas 2 e 3.
- Agrupar por processo: várias atividades do mesmo processo sob um único cabeçalho.

## O que não muda
- Filtros, seleção em lote, ordenação, clique para abrir, cores de situação, risquinho e V verde dos tratados.
- Excel e demais telas.

## Detalhes técnicos
- Arquivo: `src/components/lista/ListaAtividadesView.tsx`. Cada item vira até três `TableRow` (principal, detalhe e observação, com `colSpan` total); o hover e o clique valem para todas.
- Novas colunas "Limite" e "Fatal"; as colunas "Local / Parte" e "Observação" saem e o conteúdo vai para as linhas de baixo.
