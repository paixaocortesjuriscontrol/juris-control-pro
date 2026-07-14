## Diagnóstico

A tela `Análise DJEN` está mostrando "Nenhuma duplicada encontrada" porque a RPC `descartar_duplicadas_coordenacao` foi endurecida em 02/07 e passou a exigir, além de mesmo processo e mesmo conteúdo normalizado, que as publicações do grupo tenham `id_djen` NÃO nulo e **diferentes entre si** (`COUNT(DISTINCT id_djen) > 1`).

Isso ignora justamente os casos que apareciam antes:
- Duplicadas vindas do Kurier (id_djen nulo)
- Duplicadas com mesmo id_djen capturado duas vezes por origens/execuções distintas
- Qualquer par onde só um lado tem id_djen preenchido

**Regra da versão anterior (que funcionava — migration `20260702130249`):**

Particiona por:
```
coordenação + regexp_replace(processo_numero, '\D', '') + md5(djen_normalize_conteudo_descarte_sem_intimados(conteudo))
```
mantém a mais antiga (`created_at ASC, id ASC`) e descarta o resto. Sem qualquer filtro por `id_djen`.

## Plano

1. Criar nova migration substituindo `descartar_duplicadas_coordenacao(uuid, date, date)` para voltar à regra baseada apenas em **coordenação + processo (dígitos) + conteúdo normalizado sem intimados**.
2. Preservar as melhorias operacionais da versão atual:
   - Intervalo de datas com timezone BRT (default = hoje quando ambos vazios).
   - Ramo UNION ALL para pegar publicações com `coordenacao_id` direto **e** publicações legadas com `coordenacao_id` nulo mas monitoramento ligado à coordenação.
   - Uso de `_dup_ids` temp table + INSERT em `publicacoes_djen_descartadas` + DELETE em `publicacoes_djen`.
   - Retorno com `lote_id` para permitir "Desfazer último descarte".
   - Índices já criados pela migration atual (`idx_publicacoes_djen_descartar_coord_data`, etc.) permanecem.
3. Motivo de descarte gravado: `duplicada_mesmo_processo_conteudo_sem_intimados` (para diferenciar do lote antigo `duplicada_lote` e do atual mais restrito). O botão "Desfazer último descarte" já filtra pelo `lote_id`, então continua funcionando.
4. Nenhuma alteração no frontend — o botão continua chamando a mesma RPC com os mesmos parâmetros.

## Regra resultante

Uma publicação é considerada duplicada quando existe outra na **mesma coordenação**, com **mesmos dígitos de processo**, dentro do **intervalo de data de disponibilização** informado (ou hoje BRT se vazio), com o **mesmo conteúdo normalizado sem a seção de intimados**. Mantém a mais antiga (`created_at ASC`) e descarta as demais, independentemente de `id_djen` estar nulo ou repetido.
