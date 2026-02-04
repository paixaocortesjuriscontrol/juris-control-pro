

# Plano: Adicionar Busca Complementar por Nome da Parte

## Contexto

Publicações no DJEN podem mencionar empresas/pessoas no **nome da parte** (reclamante/reclamado) sem incluí-las no **texto/conteúdo** da publicação. Quando isso acontece, a busca atual por palavra-chave não encontra essas publicações.

**Exemplo real**: "UNIAO QUIMICA FARMACEUTICA NACIONAL S A" aparece apenas no campo de parte, não no texto.

## Solução

Adicionar uma **opção configurável** no cadastro de monitoramentos para realizar uma **busca adicional pelo nome da parte** quando o tipo for "palavra-chave". Isso será uma segunda requisição separada (não variantes), evitando o ruído que as variantes curtas causaram.

---

## Alterações Necessárias

### 1. Banco de Dados (nova coluna)

Adicionar coluna `buscar_parte` (boolean, default false) na tabela `monitoramentos_djen`:

```sql
ALTER TABLE monitoramentos_djen 
ADD COLUMN buscar_parte boolean DEFAULT false;

COMMENT ON COLUMN monitoramentos_djen.buscar_parte IS 
  'Quando true, realiza busca adicional pelo termo como nome de parte além da busca por palavra-chave';
```

### 2. Dialog de Cadastro (`MonitoramentoDialog.tsx`)

Na aba "Filtros", adicionar checkbox que aparece apenas quando tipo = "palavra-chave":

```
☐ Buscar também no nome das partes
   Quando ativo, realiza uma segunda busca usando o termo como nome 
   de parte (reclamante/reclamado). Útil para razões sociais de empresas.
```

**Campos a adicionar no estado**:
- `buscarParte: boolean` (carregado de `monitoramento.buscar_parte`)

**Alterações**:
- Adicionar checkbox na aba "Filtros", condicional ao tipo "palavra-chave"
- Incluir `buscar_parte` nos dados enviados ao backend

### 3. Engine de Busca (`useDjenTermosEngine.ts`)

Na função `processarTermo()`, após a busca padrão por palavra-chave:

```typescript
// Busca padrão por palavra-chave (como hoje)
const resultadosPalavraChave = await buscarPjeComunicaPaginado({ ... });

// Se buscar_parte estiver ativo, fazer segunda busca
if (mon.buscar_parte && tipo === 'palavra-chave') {
  const resultadosParte = await buscarPjeComunicaPaginado({
    tipo: 'palavra-chave',
    palavraChave: termoPuro, // Mesmo termo, mas como "parte"
    // ... mesmos parâmetros de data/tribunal
  });
  
  // Mesclar resultados (deduplicar por ID)
  // A validação de conteúdo já existe e vai garantir que o termo aparece
}
```

**Observação**: Como a API PJE Comunica não tem parâmetro específico `nomeParte`, a estratégia é:
- A busca `texto=TERMO` já cobre casos onde o termo está no conteúdo
- Quando `buscar_parte=true`, fazer a mesma busca mas validar se o termo aparece nos campos `polo_ativo`, `polo_passivo`, ou no texto extraído da publicação
- A validação existente `conteudoContemTermo()` já verifica o texto completo, que inclui metadados de partes quando presentes

### 4. Hook `useBuscaDjenDireta.ts` (busca manual)

Aplicar a mesma lógica para a tela de "Buscar DJEN" quando o usuário marcar a opção de buscar em partes.

### 5. Edge Function Backend (`monitorar-djen/index.ts`)

Replicar a lógica de busca adicional para execuções automáticas via cron.

---

## Fluxo de Execução (quando `buscar_parte=true`)

```text
1. Busca padrão: texto="UNIAO QUIMICA FARMACEUTICA..."
   → Retorna publicações onde o termo está no conteúdo

2. Busca adicional (mesma API, mas com validação relaxada):
   → Valida também se o termo aparece nos metadados de parte
   → Ou: valida se polo_ativo/polo_passivo contém o termo

3. Mescla resultados (deduplicando por ID)

4. Salva publicações válidas
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Migração SQL** | Adicionar coluna `buscar_parte` |
| `src/integrations/supabase/types.ts` | Regenerar tipos após migração |
| `src/components/djen/MonitoramentoDialog.tsx` | Adicionar checkbox na aba Filtros |
| `src/hooks/useMonitoramentosDjen.ts` | Incluir `buscar_parte` no tipo e nas mutações |
| `src/hooks/useDjenTermosEngine.ts` | Implementar busca adicional em `processarTermo()` |
| `src/hooks/useBuscaDjenDireta.ts` | Adicionar opção e lógica correspondente |
| `supabase/functions/monitorar-djen/index.ts` | Implementar busca adicional no backend |

---

## Vantagens da Abordagem

1. **Opt-in**: Não afeta monitoramentos existentes (default false)
2. **Preciso**: Uma busca dedicada, sem variantes que trazem ruído
3. **Mantém validação**: A validação estrita continua ativa
4. **Retrocompatível**: Monitoramentos existentes continuam funcionando igual

## Considerações

- **Requisições adicionais**: Cada termo com `buscar_parte=true` fará 2x requisições (uma padrão + uma para partes)
- **Throttling**: Os delays configurados serão aplicados entre as buscas
- **Deduplicação**: Publicações encontradas em ambas as buscas serão deduplicadas pelo ID

