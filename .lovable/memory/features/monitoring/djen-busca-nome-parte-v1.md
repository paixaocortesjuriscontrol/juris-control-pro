# Memory: features/monitoring/djen-busca-nome-parte-v1
Updated: 04/02/2026

## Busca Complementar por Nome de Parte

O sistema DJEN agora suporta uma opção configurável `buscar_parte` (boolean) no cadastro de monitoramentos que realiza uma **busca adicional pelo nome da parte** quando o tipo é "palavra-chave".

### Motivação:
Publicações podem mencionar empresas/pessoas apenas no campo de **nome da parte** (reclamante/reclamado) sem incluí-las no texto principal. A busca padrão por palavra-chave não encontra essas publicações.

### Implementação:

1. **Banco de Dados**: 
   - Coluna `buscar_parte` (boolean, default false) na tabela `monitoramentos_djen`

2. **Dialog de Cadastro** (`MonitoramentoDialog.tsx`):
   - Checkbox "Buscar também no nome das partes" na aba "Filtros"
   - Visível apenas para tipo "palavra-chave"

3. **Engine de Busca** (`useDjenTermosEngine.ts`):
   - Após a busca padrão, se `buscar_parte=true`, faz segunda busca usando `nomeAdvogado` como proxy
   - Resultados são mesclados e deduplicados pelo ID

4. **Edge Function** (`monitorar-djen/index.ts`):
   - Adiciona candidatos de busca com `nomeAdvogado` quando `buscar_parte=true`

### Fluxo:
```
1. Busca padrão: texto="EMPRESA XYZ LTDA"
   → Retorna publicações onde o termo está no conteúdo

2. Busca adicional (quando buscar_parte=true):
   → Usa nomeAdvogado="EMPRESA XYZ LTDA" como proxy para partes
   → Captura publicações onde o nome aparece nos metadados

3. Mescla resultados (deduplicando por ID)

4. Validação normal (exclusões, condições, etc.)

5. Salva publicações válidas
```

### Características:
- **Opt-in**: Não afeta monitoramentos existentes (default false)
- **Preciso**: Uma busca dedicada, sem variantes que trazem ruído
- **Retrocompatível**: Monitoramentos existentes continuam funcionando igual
- **Requisições adicionais**: ~2x requisições para termos com `buscar_parte=true`
