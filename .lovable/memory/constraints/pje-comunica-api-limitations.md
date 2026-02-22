# Memory: constraints/pje-comunica-api-limitations
Updated: 22/02/2026

A API de listagem do PJE Comunica (/comunicacao) retorna metadados estruturados de advogados no campo `destinatarioadvogados[]`, com `{ advogado: { nome, numero_oab, uf_oab } }` para cada advogado. Os destinatários (partes notificadas) vêm no campo `destinatarios[]`. Ambos os campos são capturados e salvos nas colunas `advogados_json` e `partes_json` da tabela `publicacoes_djen`. Com isso, toda a barra lateral (órgão, tipo, meio, partes, advogados) pode ser preenchida diretamente dos dados estruturados da API, sem dependência de regex. O regex é mantido apenas como fallback para publicações antigas que não possuem os campos estruturados.
