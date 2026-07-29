## Diagnóstico (verificado)

Hoje o Kurier **não considera** os tribunais cadastrados no termo:

- Em `supabase/functions/kurier-consultar-publicacoes/index.ts`, a query de monitoramentos (linha ~659) seleciona `id, tipo, termo_busca, oab, uf, exclusoes, condicao_concomitante, termos_or, descricao, buscar_parte, coordenacao_id, criado_por, somente_kurier` — a coluna `tribunais` **não é lida**.
- O matching (`kurierMatchesMonitoramento`, linha ~481, e o loop da linha ~1057) valida só termo/OAB/exclusões/condição concomitante. Nenhuma checagem de tribunal.
- O motor Servidor DJEN Termos já faz isso: `monitor-servidor/engines/paralela.js` linha 1232 — `if (tribunaisMon.length > 0 && !tribunaisMon.includes(tribunal))` → descarta com motivo `tribunal_nao_permitido`.

Complicador confirmado nos dados: o Kurier grava o tribunal em formatos livres, enquanto os termos usam sigla canônica.

```text
Kurier (publicacoes_djen.tribunal)   Termo (monitoramentos_djen.tribunais)
"TRT 10_DJEN"                        "TRT10"
"TRT - 2 REGIAO"                     "TRT2"
"TJSP_DJEN - ESTADUAL"               "TJSP"
"DJMG" / "DJMG - Judiciário"         "TJMG"
"TRF 1"                              "TRF1"
```

Sem normalização, um filtro literal descartaria quase tudo.

## O que será feito

1. **Normalizador de sigla de tribunal (Kurier)**
   Nova função em `supabase/functions/_kurier-shared/` que converte a string bruta do Kurier na sigla canônica: remove sufixos (`_DJEN`, `- ESTADUAL`, `- Judiciário`), remove espaços/hífens internos (`TRT - 10 REGIAO` → `TRT10`), e mapeia diários estaduais conhecidos (`DJMG`→`TJMG`, `DJMS`→`TJMS`, etc.). Retorna `null` quando não reconhece.

2. **Carregar `tribunais` do monitoramento**
   Incluir a coluna na query de monitoramentos e no tipo usado no matching.

3. **Aplicar o filtro no matching**
   Ao avaliar cada candidato: se o monitoramento tem `tribunais` preenchido e a sigla normalizada da publicação **não** está na lista, o candidato não casa (segue para o próximo termo). Termo sem `tribunais` (nulo/vazio) continua aceitando qualquer tribunal — mesma regra do Servidor.

4. **Sigla não reconhecida**
   Se a normalização falhar, **não descartar**: o item passa (comportamento conservador, para não perder publicação por formato novo do Kurier) e é registrado em log para ajuste do mapa.

5. **Descarte igual ao DJEN Termos Servidor**
   Quando nenhum termo casar por causa do tribunal, a publicação **não** é inserida em `publicacoes_djen`; conta em `total_descartadas` e o motivo `tribunal_nao_permitido` é gravado em `kurier_publicacoes_raw.motivo_descarte` (mesmo caminho já usado para `sem_match_monitoramento`), preservando rastreabilidade.

6. **Captura total permanece intacta** — conforme definido, coordenações com captura total continuam recebendo tudo que o Kurier trouxer, sem filtro de tribunal.

## Detalhes técnicos

- Arquivos tocados: `supabase/functions/_kurier-shared/` (novo utilitário + export), `supabase/functions/kurier-consultar-publicacoes/index.ts`. `kurier-consultar-personalizado` recebe o mesmo filtro se compartilhar o caminho de matching.
- Nenhuma migração de banco: `monitoramentos_djen.tribunais` já existe e está populado.
- Nenhum efeito retroativo — vale só para execuções novas.
- `monitor-servidor/engines/kurier.js` não muda: ele apenas invoca a edge function.
- Validação após o deploy: rodar uma credencial via `curl_edge_functions` e conferir nos logs a contagem de `tribunal_nao_permitido` e que nada com tribunal válido foi barrado.
