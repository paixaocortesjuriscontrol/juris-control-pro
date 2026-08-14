# Corrigir tipo de recurso preenchido pelo Judit

## Problema (verificado)
Processo `0000134-41.2025.5.13.0009` (TRT13, fase "Execução ou Cumprimento"): o retorno da Judit gravado nos logs para esse processo traz **apenas a 1ª instância** e **sem classe/classificação** — não há instância recursal no TST. Mesmo assim o registro em Dados Benner está com `tipo_recurso = "Agravo de Instrumento"`.

Na função `buscar-judit` há dois pontos que produzem exatamente esse comportamento:

1. **Chute do lado do recurso** (linhas ~1193-1196): quando não dá para identificar quem recorreu, o código faz `tipo_recurso_banco = classe` com o comentário "Banco é o cliente; assume que é ele recorrendo". Isso preenche o campo do banco sem qualquer evidência de recurso do banco.
2. **Sigla genérica** (`ai: "Agravo de Instrumento"`): uma classe de 1ª/2ª instância é expandida para nome de recurso, e a tela passa a tratá-la como recurso do TST.

## O que será feito

0. **Subir a versão para v4.5.2**
   - Atualizar `src/constants/version.ts` e `public/version.json` antes das correções.

1. **Nunca chutar o lado do recurso**
   - Remover o fallback que atribui a classe ao banco quando a origem é desconhecida.
   - Sem parte identificada como RECORRENTE/AGRAVANTE/EMBARGANTE cruzada com a origem, os três campos (`tipo_recurso_banco`, `tipo_recurso_reclamante`, `tipo_recurso_terceiro`) voltam vazios.

2. **Só devolver tipo de recurso quando houver instância recursal**
   - `tipo_recurso` passa a ser preenchido apenas quando a instância selecionada é recursal (TST) e a classe vem das `classifications` daquela instância.
   - Havendo só 1ª instância (como neste processo), a função devolve `tipo_recurso = null` e não sobrescreve nada na tela.

3. **Não "inventar" nome de recurso**
   - A expansão de siglas deixa de transformar a sigla genérica `AI` em "Agravo de Instrumento" fora do contexto TST; no TST a sigla continua sendo lida como "Agravo de Instrumento em Recurso de Revista" (AIRR).

4. **Transparência para a advogada**
   - Quando a Judit não trouxer recurso, a tela mantém o aviso já existente de "Judit sem tipo de recurso", em vez de aplicar qualquer valor.

5. **Corrigir o dado atual**
   - Limpar os campos de recurso preenchidos indevidamente nesse processo (`tipo_recurso`, `tipo_recurso_reclamante`), deixando para preenchimento manual/IA.

## Detalhes técnicos
- Arquivo principal: `supabase/functions/buscar-judit/index.ts` (bloco de atribuição por parte, `expandirSiglaRecurso`, montagem de `result`).
- Sem mudança de schema; apenas correção pontual dos dados do processo citado.
- Nenhuma alteração em `DistribuicaoTstForm.tsx` além do comportamento já existente de "aplicar somente se a Judit trouxe valor".