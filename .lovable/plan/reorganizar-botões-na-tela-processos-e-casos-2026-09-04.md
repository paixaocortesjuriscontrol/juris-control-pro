# Reorganizar botões na tela Processos e Casos

## Objetivo
Colocar **Novo Processo** e **Novo Caso** na mesma linha do campo "Digite algo para pesquisar", e fundir as ações restantes (Transferir, Selecionar, Exportar, Manual PDF) na linha do botão **Etiquetas**, eliminando a linha de ações separada.

## Mudanças (apenas `src/pages/Processos.tsx`)

### 1. Linha de busca (hoje ~linhas 565-611)
- Adicionar ao final da linha (com `ml-auto` para empurrar à direita) os botões **Novo Processo** (`bg-primary`) e **Novo Caso** (`variant="outline"`), ambos `h-9`, mantendo ícone `Plus` e `span hidden sm:inline`.

### 2. Linha de etiquetas + ações (hoje ~linhas 728-923)
- Juntar os dois blocos atuais ("Filtros combinados" e "Action Buttons Row") em um único `div` flex.
- Manter à esquerda: Acompanhamento Especial, Segredo de Justiça e EtiquetaFilter.
- À direita (`ml-auto`): Transferir, Selecionar, Exportar (dropdown) e Manual PDF — todos `h-9`.
- Remover Novo Processo e Novo Caso deste bloco (já foram para a linha de busca).
- Manter o modo seleção: quando `isSelectionMode`, mostra "Selecionar/Desmarcar todos" + "Cancelar" à direita.

### Resultado visual
```
[Digite algo...] [Filtros] [Situação] [cache] [N processos] ....... [Novo Processo] [Novo Caso]
[Acomp. Especial] [Segredo] [Etiquetas] ....... [Transferir] [Selecionar] [Exportar] [Manual PDF]
```

## Nada de banco de dados
Apenas reorganização de JSX/CSS. Sem queries, sem schema.
