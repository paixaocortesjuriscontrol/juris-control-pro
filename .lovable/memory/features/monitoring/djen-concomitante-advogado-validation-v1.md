# Memory: features/monitoring/djen-concomitante-advogado-validation-v1
Updated: 05/02/2026

## Problema Corrigido

### Bug 1: Termo de Busca Exibido como Advogado
O componente `PublicacaoConteudoDjen` adicionava incorretamente o **termo de monitoramento** na lista de advogados da publicação. Isso confundia a validação e exibição.

**Correção**: Removida a lógica que usava `monitoramentoOab`/`monitoramentoTermo` como advogado. Advogados são extraídos apenas do conteúdo da publicação.

### Bug 2: "+" no Termo Não Processado como AND
Quando o termo de busca contém "+" (ex: `DR. OSMAR + SERVICO DE APOIO + TRABALHISTAS`), cada parte separada por "+" deve ser validada como condição AND. Anteriormente, o "+" era ignorado e apenas uma validação parcial era feita.

**Correção**: 
- `useDjenTermosEngine.ts`: Se `termo.includes('+')`, valida cada parte separadamente com 80% das palavras
- `useBuscaDjenDireta.ts`: Mesma lógica aplicada na função `conteudoContemTermoOuOr`

### Lógica de Validação:
```typescript
// Se termo tem "+" → validar CADA parte
const partesAnd = termo.split('+').map(p => p.trim());
for (const parte of partesAnd) {
  if (parte.match(/^OAB\s/i)) continue; // Ignora "OAB TODAS-15553"
  // Valida 80% das palavras de cada parte
}
```

## Arquivos Atualizados
- `src/components/djen/PublicacaoConteudoDjen.tsx` - Removida exibição incorreta
- `src/hooks/useDjenTermosEngine.ts` - Validação AND para termos com "+"
- `src/hooks/useBuscaDjenDireta.ts` - Mesma validação AND
