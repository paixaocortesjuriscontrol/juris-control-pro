# Memory: features/monitoring/djen-concomitante-advogado-validation-v1
Updated: 05/02/2026

## Problema Corrigido

Quando um monitoramento de **advogado (OAB)** tinha uma **condição concomitante**, o sistema:
1. ✅ Buscava publicações pelo filtro OAB na API
2. ✅ Validava se a condição concomitante estava presente
3. ❌ **NÃO validava se o advogado/OAB estava no conteúdo**

Isso permitia que publicações de OUTROS advogados fossem capturadas, desde que contivessem o termo da condição concomitante.

### Exemplo do Bug
- Monitoramento: OAB 15553 + Condição "SERVICO DE APOIO"
- Publicação de outro advogado mencionando "SERVICO DE APOIO" era capturada erroneamente

## Solução

No `useDjenTermosEngine.ts`, a validação do termo/OAB agora é **obrigatória quando há condição concomitante**, mesmo para tipos `advogado` e `parte`:

```typescript
const temCondicaoConcomitante = mon.condicao_concomitante && mon.condicao_concomitante.trim().length > 0;
const deveValidarTermo = (mon.tipo !== 'advogado' && mon.tipo !== 'parte') || temCondicaoConcomitante;

if (deveValidarTermo) {
  // Valida termo/OAB no conteúdo
}
```

### Lógica de Validação:
- **Advogado sem condição concomitante**: API filtra corretamente, não valida (evita falso descarte)
- **Advogado COM condição concomitante**: DEVE validar OAB/nome no conteúdo
- **Parte sem condição**: API filtra, não valida
- **Parte COM condição**: DEVE validar termo no conteúdo
- **Palavra-chave**: Sempre valida

## Arquivos Atualizados
- `src/hooks/useDjenTermosEngine.ts` - Frontend engine
