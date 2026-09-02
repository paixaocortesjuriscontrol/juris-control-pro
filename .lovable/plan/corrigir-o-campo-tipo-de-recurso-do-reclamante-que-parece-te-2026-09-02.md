# Corrigir o campo "Tipo de Recurso do Reclamante" que parece ter "Tipo" selecionado

## O que está acontecendo

No processo 0100386-97.2023.5.01.0060 o valor gravado no banco para o Tipo de Recurso do Reclamante está **vazio** (nulo) — nada foi selecionado e nada foi apagado. O que aparece escrito "Tipo" dentro do campo é apenas o texto de espera (placeholder) do seletor de recurso, que ficou diferente de todos os outros campos da tela (que mostram "Selecione").

Ou seja: é um problema visual/de texto, não de dados. Como "Tipo" parece um valor escolhido, a tela dá a impressão de que o campo já foi preenchido — daí a confusão em "vários" processos.

Confirmado no banco para esse processo: Tipo de Recurso do Reclamante vazio, Matérias do Reclamante vazias, chance de êxito do Reclamante vazia, Parte Recorrente = "Reclamada" (por isso o quadro do Reclamante não é exigido).

## O que será feito

1. Trocar o texto de espera do seletor de tipo de recurso de "Tipo" para "Selecione", igualando ao padrão do restante do formulário (Reclamante e Banco usam o mesmo componente, então ambos ficam corretos).
2. Adicionar no seletor uma opção explícita "Selecione" no topo, que limpa o campo — hoje só existe o "X" ao lado, e sem opção de limpar dentro da lista o usuário não tem como voltar ao estado vazio pela própria lista.
3. Manter intacto o comportamento de múltiplos tipos (separador " + "), os valores fora da lista oficial marcados em vermelho com "(NÃO PODE ENVIAR BENNER)" e as regras de pendência/obrigatoriedade.

Nenhuma alteração de dados ou de banco é necessária.

## Detalhes técnicos

- `src/components/distribuicao-tst/MultiTipoRecurso.tsx`: `SelectValue placeholder="Tipo"` → `"Selecione"`; incluir `<SelectItem value="__none__">Selecione</SelectItem>` e tratar `__none__` no `onValueChange` como limpeza da posição (`setAt(idx, "")` → `commit` grava `null` quando não sobra nenhum tipo).
- Sem mudanças em `distribuicaoTstPendencias.ts` nem em `DistribuicaoTstForm.tsx`.
