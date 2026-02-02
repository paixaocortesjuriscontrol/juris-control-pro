
# Plano: Correção dos 8 Erros de Build (GitHub não corrigiu)

## Situação Atual

Os arquivos sincronizados do branch `main_v1.0.6` do GitHub **não corrigiram nenhum dos erros**. Todas as 8 correções que propus anteriormente precisam ser aplicadas.

---

## Erros e Correções Necessárias

### 1. useDjenTermosEngine.ts - Linha 67-77
**Erro**: `condicao_concomitante` não existe em `Monitoramento`

**Correção**: Adicionar o campo à interface:
```typescript
interface Monitoramento {
  id: string;
  tipo: 'palavra-chave' | 'advogado' | 'processo' | 'parte';
  termo_busca: string;
  oab?: string;
  uf?: string;
  ativo: boolean;
  exclusoes?: string[];
  tribunais?: string[];
  descricao?: string | null;
  condicao_concomitante?: string | null;  // ADICIONAR
}
```

### 2. useDjenTermosEngine.ts - Linha 341-356
**Erro**: `.catch` não existe em `PromiseLike`

**Correção**: Converter para async/await IIFE:
```typescript
const promise = (async () => {
  try {
    await supabase
      .from('configuracoes_monitoramento')
      .update({ metadata })
      .eq('tipo', 'djen')
      .is('coordenacao_id', null);
  } catch (err: any) {
    console.warn('[DJEN] Falha ao atualizar metadata:', err?.message || err);
  } finally {
    if (singletonState.metadataPersistInFlight === promise) {
      singletonState.metadataPersistInFlight = null;
    }
  }
})();
```

### 3. useDjenTermosEngine.ts - Linha 739
**Erro**: Falta `descartadasTribunal` no retorno

**Correção**: Adicionar a propriedade:
```typescript
return { novas: 0, duplicadas: 0, descartadas: 0, descartadasTribunal: 0 };
```

### 4. DjenTermosDashboardCardV2.tsx - Linha 105-108
**Erro**: `metadata` não existe em `Query<...>`

**Correção**: Acessar via `query.state.data`:
```typescript
refetchInterval: (query) => {
  const md = (query?.state?.data?.metadata as Record<string, any> | null) || {};
  return md?.status === 'em_andamento' ? 3000 : 8000;
},
```

### 5. DjenTermosDashboardCardV2.tsx - Linha 333
**Erro**: `status` não existe em `Query<...>`

**Correção**: Acessar via `query.state.data`:
```typescript
refetchInterval: (query) => (query?.state?.data?.status === 'em_andamento' ? 3000 : false),
```

### 6. useDjenTermos.ts - Linhas 186-193
**Erro**: Tabelas `djen_diario_publicacoes` e `djen_diario_index` não existem no schema tipado

**Correção**: Usar type assertion:
```typescript
const { error: errPublicacoes } = await (supabase as any)
  .from('djen_diario_publicacoes')
  .delete()
  .eq('diario_ymd', dataYmd);

const { error: errIndex } = await (supabase as any)
  .from('djen_diario_index')
  .delete()
  .eq('diario_ymd', dataYmd);
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/hooks/useDjenTermosEngine.ts` | 3 correções: interface, Promise API, return incompleto |
| `src/components/configuracoes/DjenTermosDashboardCardV2.tsx` | 2 correções: refetchInterval (linhas 106 e 333) |
| `src/hooks/useDjenTermos.ts` | 1 correção: type assertion para tabelas não tipadas |

---

## Resumo

O branch do GitHub que você sincronizou **não incluiu as correções** para os erros de TypeScript. Precisarei aplicar todas as 8 correções aqui no Lovable para o build funcionar.
