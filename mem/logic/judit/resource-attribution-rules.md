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
- Frontend usa `pickJuditOnly` (não `pick`) para os 3 campos: vazio da Judit APAGA valor antigo.
- UI mostra aviso amarelo abaixo de "Tipo de Recurso" quando `_judit_meta.fonte_tipo_recurso='nenhuma'`.