# Memory: features/monitoring/djen-concomitante-metadados-v1
Updated: 23/02/2026

## Condição Concomitante com Metadados Estruturados

A função `condicaoConcomitanteAtendida` agora recebe o objeto `pub` (raw da API) como terceiro parâmetro opcional e verifica a condição concomitante em **duas fontes**:

1. **Texto da publicação** (`conteudo`) — comportamento original
2. **Metadados estruturados**: `destinatarios[].nome`, `poloAtivo`, `poloPassivo`, `destinatarioNome`, `destinatarioadvogados[].advogado.nome`

### Lógica:
- Concatena texto + metadados em um único texto normalizado
- Aplica a mesma lógica OR (`|`) e AND (`,`) sobre o texto concatenado
- Ex: "SANTANDER" nos polos da publicação satisfaz a condição mesmo sem aparecer no corpo

### Arquivos alterados:
- `src/hooks/useDjenTermosEngine.ts` — função `condicaoConcomitanteAtendida` + chamada na validação
- `src/hooks/useBuscaDjenDireta.ts` — mesma alteração (espelhada)
