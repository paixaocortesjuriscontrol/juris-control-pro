# Mover "Pasta do Cliente" para a área Identificação

A sugestão procede: na ficha do processo (Visão Geral), "Pasta do Cliente" está na seção "Pastas e Descrição", lá embaixo, longe da Identificação.

## O que muda
- "Pasta do Cliente" passa para a seção **Identificação**, logo depois do Número do Processo (e antes de "Objeto da ação"), tanto ao cadastrar quanto ao editar um processo.
- A seção "Pastas e Descrição" fica só com Pasta Física e Descrição.
- Nada muda nos dados: o mesmo campo continua sendo gravado; só a posição na tela.

## Detalhes técnicos
- `src/components/processos/ProcessoVisaoGeralForm.tsx`: mover o `FormField` de `pasta_cliente` (linha ~2147) para dentro do grid da seção Identificação, fora do bloco `isNovo`, para aparecer sempre.
