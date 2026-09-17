# Trânsito em julgado não deve gerar pendência na Distribuição TST

## O que está acontecendo (confirmado nos dados)

Hoje existem 7 fichas com **Trânsito em julgado** marcadas como Pronto/Planilhado/Enviado, e **todas as 7 estão contadas como "Pronto com pendência"**. Além disso, 6 delas estão com o marcador "Revisar lista de matérias" e 1 com o aviso "somente Outra Matéria".

Motivo: o sistema trata "Trânsito em julgado" de duas formas diferentes.

- Nos filtros e totalizadores da tela, trânsito em julgado entra em **"Não precisa fazer"** (junto com Outro escritório, Segredo de justiça, CEJUSC e Acordo).
- No cálculo de pendências, trânsito em julgado **não** está na lista de "não precisa fazer". Quando a ficha está marcada como Pronto, ele gera a pendência "Trânsito em julgado — NÃO irá para a planilha de Carga Benner", e as demais regras (revisar lista de matérias, aviso de Outra Matéria) continuam sendo aplicadas.

Resultado: a mesma ficha aparece como "Não precisa fazer" nos cards de situação e como "Pronto com pendência" no card de pendências.

## Correção proposta

Passar a tratar Trânsito em julgado exatamente como Acordo/CEJUSC/Outro escritório/Segredo de justiça:

- Ficha com trânsito em julgado **não gera pendência**, mesmo marcada como Pronto.
- Não recebe o marcador "Revisar lista de matérias" nem o aviso "somente Outra Matéria".
- Continua **rejeitada na planilha de Carga Benner**, com o motivo "Trânsito em julgado" na aba de rejeitados — isso não muda.
- Continua aparecendo como "Não precisa fazer" nos cards e filtros de situação — como já aparece hoje.

Depois da mudança, corrigir no banco as marcações antigas dessas fichas (as 7 prontas com trânsito, mais qualquer outra com os marcadores de revisar/aviso ligados), para os cards baterem sem precisar clicar em "Verificar Pendências".

## Detalhes técnicos

- `src/utils/distribuicaoTstPendencias.ts`: incluir `transito_julgado === true` em `isNaoPrecisaFazer`.
- `src/utils/distribuicaoTstSemPendencia.ts`: com isso, `calcularSemPendencia`, `calcularRevisarListaMaterias`, `calcularSomenteOutraMateria` e `semNenhumaMateriaDoDossie` passam a ignorar essas fichas automaticamente; avançar `REGRA_PENDENCIAS_ATUALIZADA_EM` para a data/hora desta mudança, para a revalidação em segundo plano reprocessar as fichas antigas.
- `getSituacaoImpeditiva` e `getMotivoBloqueioCarga` permanecem intactos (a rejeição na Carga Benner continua).
- Migração de acerto: `sem_pendencia = true`, `revisar_lista_materias = false`, `somente_outra_materia = false`, `sem_nenhuma_materia_dossie = false` para `dados_benner` com `transito_julgado = true`.

## Verificação

- Conferir que as 7 fichas com trânsito saem do card "Pronto com pendência" e que o card "Trânsito em Julgado" continua com o mesmo total.
- Gerar a Carga Benner com uma dessas linhas selecionada e confirmar que ela continua na aba de rejeitados com o motivo "Trânsito em julgado".
