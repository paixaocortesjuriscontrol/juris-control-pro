---
name: Judit Resource Attribution Rules
description: Tipo de recurso só vem de movimento Judit confirmado, sem fallback DataJud, vazio sobrescreve antigos
type: feature
---
Tipo de recurso (`tipo_recurso`, `tipo_recurso_reclamante`, `tipo_recurso_banco`)
só pode ser preenchido quando a Judit confirma a interposição em `page_data.steps`
via `extrairRecursosPorParte` (movimento de INTERPOSIÇÃO + identificação de lado).

Proibido como fonte de tipo de recurso:
- Classe da capa (`classifications`) — é a classe processual atual, não comprova quem recorreu.
- `inferirRecursosRecorrentesPorPartes` (person_type ATIVE/PASSIVE) — gera duplicação.
- DataJud TST — pode complementar tribunal/relator/turma, nunca tipo de recurso.

Regras:
- Quando a Judit não confirma, retornar `null` nos 3 campos + `_judit_meta.fonte_tipo_recurso='nenhuma'`.
- Frontend usa `pickJuditOnly`/`applyJuditOnly` (não `pick`/`apply`) para os 3 campos
  em TODOS os formulários que consomem Judit — `DadosBennerForm.tsx` e
  `DistribuicaoTstForm.tsx`. Vazio da Judit APAGA valor antigo (inclusive valor
  herdado de planilha importada).
- UI mostra aviso amarelo abaixo de "Tipo de Recurso" quando `_judit_meta.fonte_tipo_recurso='nenhuma'`.
- AUTOR EXPLÍCITO TEM PRECEDÊNCIA: quando o próprio andamento diz
  "RECURSO/AGRAVO/EMBARGOS … DE <NOME DA PARTE>" (ex.:
  "RECEBIDO O RECURSO ORDINÁRIO DE MARCELA LAZARO PEREIRA"), a parte
  recorrente é decidida cruzando `<NOME>` com tokens de `nomesAtivo`/`nomesPassivo`.
  Intimações vizinhas (`EXPEDIDO INTIMAÇÃO A …`) NÃO podem inverter esse
  resultado — caso contrário o recurso da reclamante é atribuído ao banco
  porque a intimação seguinte é sempre ao polo contrário.