## Objetivo
Garantir que **todas as publicações DJEN** (qualquer coordenação) fiquem com conteúdo limpo — sem HTML bruto, entidades quebradas ou lixo nos campos `advogados_json` / `partes_json`.

## 1. Daqui para frente (já implementado — confirmar)
Nenhuma mudança de código necessária. Já está ativo para **todas as coordenações**:
- `src/utils/djenLikeConteudo.ts` — sanitiza conteúdo, advogados e partes na captura.
- `src/hooks/useDjenTermosParalelaEngine.ts` — rejeita nomes com `<` ou `&` na gravação.
- `kurier-consultar-publicacoes` — sanitiza payload da API Kurier.
- `PublicacaoConteudoDjen.tsx` + `formatConteudo.ts` — limpam no render como rede de segurança.

## 2. Backfill — somente hoje (29/06/2026), todas as coordenações
Executar limpeza SQL em `publicacoes_djen` filtrando `data_disponibilizacao = '2026-06-29'` **sem filtro por coordenação**:

1. **`conteudo`**: aplicar o mesmo pipeline já usado no backfill Kurier:
   - Transformar `<tr>/<td>` em quebras de linha + `:`.
   - Remover demais tags HTML.
   - Decodificar entidades (incluindo as quebradas por `\n` e sem `;`): `&Eacute`, `&aacute;`, `&sect;`, `&ccedil;`, `&atilde;`, etc.
   - Colapsar espaços e linhas em branco.

2. **`advogados_json`**: remover elementos cujo `nome` contenha `<`, `&`, tenha > 120 chars, ou seja fragmento de URL/href.

3. **`partes_json`**: mesma regra de rejeição de lixo no campo `nome`.

4. Aplicar também em `publicacoes_djen_servidor` para o mesmo dia, mesma lógica.

Escopo da query: `WHERE data_disponibilizacao = '2026-06-29'` (BRT) — sem mexer em dias anteriores nem em outras coordenações específicas.

## 3. Validação
- Recontar quantas linhas foram alteradas por tabela.
- Spot-check no `/valida-kurier` e na Análise DJEN do dia para confirmar que sumiu o HTML.

## Fora de escopo
- Backfill de dias anteriores a 29/06/2026.
- Mudanças de UI ou de motor (já corrigidos).
