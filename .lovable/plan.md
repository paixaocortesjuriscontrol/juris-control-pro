

## Problema

A funcao `condicaoConcomitanteAtendida` verifica a condicao concomitante **apenas no texto** (`conteudo`) da publicacao. Porem, para monitoramentos de advogados com condicao concomitante (ex: advogado "OSMAR MENDES" + condicao "SANTANDER"), o nome do cliente pode estar apenas nos **metadados estruturados** (partes, destinatarios) e nao no corpo do texto.

Resultado: publicacoes validas sao descartadas com motivo `condicao_concomitante` porque o termo da condicao nao aparece no texto, embora esteja nos metadados.

## Solucao

Alterar a funcao `condicaoConcomitanteAtendida` (ou criar uma versao estendida) para verificar a condicao concomitante em **duas fontes**:

1. **Texto da publicacao** (comportamento atual)
2. **Metadados estruturados** da publicacao (partes_json, advogados_json, destinatarios, polos)

## Mudancas Tecnicas

### Arquivo: `src/hooks/useDjenTermosEngine.ts`

1. **Criar funcao `condicaoConcomitanteAtendidaExtendida`** que recebe o conteudo + o objeto `pub` (raw da API) e verifica a condicao concomitante em:
   - Texto da publicacao (`conteudo`)
   - Metadados de partes extraidos via `partePresenteNosMetadados` ou texto concatenado de metadados (destinatarios, polos, advogados)

2. **Alterar a chamada na linha ~1247** de:
   ```
   condicaoConcomitanteAtendida(conteudo, mon.condicao_concomitante)
   ```
   para a nova funcao que tambem recebe `pub` como parametro e faz a verificacao hibrida (texto + metadados).

3. A logica interna sera:
   - Concatenar `conteudo` + texto extraido dos metadados (partes, advogados, destinatarios) em um unico texto normalizado
   - Aplicar a mesma logica de OR (pipe `|`) e AND (virgula `,`) sobre esse texto concatenado
   - Isso garante que se "SANTANDER" aparecer nos polos ou nas partes da publicacao, a condicao e atendida

### Nenhuma outra mudanca necessaria
- A logica de busca na API permanece inalterada (busca por advogado/OAB primeiro)
- A validacao do termo principal permanece inalterada
- Apenas o passo 3 (condicao concomitante) passa a considerar metadados alem do texto

