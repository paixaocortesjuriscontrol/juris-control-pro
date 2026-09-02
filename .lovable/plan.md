# Pendência para "tipo de recurso inventado pela Judit"

## Por que a tela anterior não pegou

A validação do tipo de recurso contra a lista oficial de seleção existe em um único lugar: `src/utils/tipoRecursoOficial.ts`, usada **somente** dentro da geração da Carga Benner (`CargaBennerFromDb.tsx`). O motor de pendências (`src/utils/distribuicaoTstPendencias.ts`) só verifica se o campo "Tipo de Recurso" está **preenchido** — nunca se o valor preenchido consta na lista oficial. Por isso um processo com "AÇÃO TRABALHISTA - RITO ORDINÁRIO" gravado pela Judit aparece como "pronto, sem pendência" na lista e só é barrado na hora de gerar a planilha.

O mesmo vale para o formato do dossiê: a carga rejeita dossiê fora do padrão, e a lista só cobra dossiê vazio.

## O que muda

1. **Nova pendência**: processo cujo Tipo de Recurso (Reclamante, Banco ou Terceiro) tenha valor fora da lista oficial de seleção passa a acusar pendência, com o valor inválido no texto e o aviso de que não irá para a Carga Benner.
2. Essa pendência entra automaticamente em todos os lugares que já consomem o motor: botão "Verificar Pendências", badge/bolinha da lista, card "Prontos com pendências", kanban, relatório de pendências em Excel e cards por responsável.
3. **Destaque no formulário**: os quadros III / IV / V ficam marcados em vermelho quando o tipo de recurso está fora da lista, do mesmo jeito que já acontece com as matérias fora da lista.
4. **Nova pendência de dossiê inválido**: dossiê em formato que a carga rejeita passa a acusar pendência na lista (mesma mensagem usada no arquivo de rejeições).

Efeito prático: os 196 processos rejeitados por tipo de recurso deixam de figurar como "prontos sem pendência" e passam a aparecer no card "Prontos com pendências" para saneamento antes da geração da carga.

## Detalhes técnicos

- `src/utils/distribuicaoTstPendencias.ts`: importar `getRecursosForaDaLista` de `@/utils/tipoRecursoOficial` e, em `getPendenciasEAvisos`, após o bloco de matérias, gerar a pendência `tipo_recurso_fora_lista_oficial` quando `getRecursosForaDaLista(row).length > 0`. Label: `Tipo de recurso fora da lista oficial de seleção — NÃO irá para a planilha de Carga Benner: <campo>: "<valor>"`. `quadrinho` resolvido pelo campo inválido (III para reclamante, IV para banco, V para terceiro; III como padrão para `tipo_recurso`).
- Mesmo arquivo: pendência `dossie_formato_invalido` usando o mesmo helper de validação de dossiê da carga (`getMotivoRejeicaoDossie`, hoje em `CargaBennerFromDb.tsx` / utilitário de dossiê) — se o helper estiver local ao componente, extrair para `src/utils/dossieBenner.ts` e passar a importar nos dois lados, sem alterar a regra.
- As isenções atuais continuam valendo (Acordo, CEJUSC, outro escritório, segredo de justiça, trânsito em julgado, recorrente somente Terceiro) — nesses casos nada é cobrado, coerente com a carga.
- `src/components/distribuicao-tst/*` (formulário de análise): destacar os quadros usando a nova chave de pendência, seguindo o padrão já aplicado a `materias_fora_lista_oficial`.
- Sem mudança de banco de dados e sem mudança na regra de rejeição da Carga Benner (ela já funciona corretamente).
