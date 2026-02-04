

# Plano Corrigido: Implementar Tipo "Polo Passivo ou Ativo" com Parâmetro nomeParte

## Diagnóstico Corrigido

Você está certo! A URL que você mostrou revela que a API PJE Comunica usa **`nomeParte`** (não `nomeAdvogado`) para buscar publicações onde a empresa/pessoa aparece como polo ativo/passivo.

URL correta: `https://comunica.pje.jus.br/consulta?siglaTribunal=TJRJ&dataDisponibilizacaoInicio=2026-02-03&dataDisponibilizacaoFim=2026-02-04&nomeParte=UNIAO%20QUIMICA%20FARMACEUTICA%20NACIONAL%20S%20A`

## O Problema Atual

1. **`useDjenTermosEngine.ts`** (linhas 841-899): Tem código antigo que usa `buscar_parte=true` + `nomeAdvogado`, causando **dupla requisição** por tribunal → rate limit (429)
2. **`pjeComunicaClient.ts`**: Não suporta `nomeParte` como parâmetro
3. **`buscar-pje/index.ts`**: Não tem o tipo `'parte'` com `nomeParte`

## Solução

### 1. Atualizar Cliente PJE (`src/utils/pjeComunicaClient.ts`)

**Alterações:**
- Adicionar `'parte'` ao tipo `PjeSearchType`
- Adicionar `nomeParte?: string` ao `PjeComunicaSearchParams`
- Modificar a função `buscarPjeComunicaNoBrowser()` para construir o parâmetro `nomeParte` na query string quando `tipo === 'parte'`

**Lógica:**
```typescript
if (params.tipo === "parte") {
  const nomeParte = (params.nomeParte || "").trim();
  if (nomeParte) {
    qp.set("nomeParte", normalizeAccents(nomeParte));
  }
}
```

### 2. Limpar Engine de Termos (`src/hooks/useDjenTermosEngine.ts`)

**Remover:**
- Todo o bloco `buscar_parte` (linhas 841-899 aprox.) que causa rate limit

**Adicionar:**
- Quando `mon.tipo === 'parte'`, passar `nomeParte` em vez de `nomeAdvogado`:

```typescript
if (mon.tipo === 'parte') {
  baseParams.tipo = 'parte';
  baseParams.nomeParte = extrairPalavraChavePura(mon.termo_busca);
  variantesParaBuscar = []; // Sem variantes, busca exata
}
```

### 3. Atualizar Busca Direta (`src/hooks/useBuscaDjenDireta.ts`)

**Adicionar:**
- Opção de tipo `'parte'` na interface
- Lógica para passar `nomeParte` quando o usuário seleciona "Polo passivo ou ativo"

### 4. Atualizar Dialog (`src/components/djen/MonitoramentoDialog.tsx`)

**Remover:**
- Checkbox "Buscar também no nome das partes" da aba Filtros

**Adicionar:**
- Novo tipo "Polo passivo ou ativo" no Select de tipos, **com comportamento específico:**
  - Campo obrigatório: "Nome da Parte" (texto)
  - Sem OAB, sem UF
  - Aceita tribunais opcionalmente
  - Busca exata (sem variantes)

### 5. Atualizar Tipos (`src/hooks/useMonitoramentosDjen.ts`)

**Remover:**
- `buscar_parte?: boolean` da interface `MonitoramentoDjen`

**Manter:**
- `tipo: 'palavra-chave' | 'advogado' | 'processo' | 'parte'`

### 6. Edge Function (opcional)

**`supabase/functions/buscar-pje/index.ts`:**
- Adicionar tipo `'parte'` ao `SearchType`
- Adicionar `nomeParte?: string` ao `SearchParams`
- Implementar case `parte` que constrói URL com `nomeParte`

### 7. Backend (`supabase/functions/monitorar-djen/index.ts`)

**Manter:**
- Lógica existente que já suporta tipos diversos
- Apenas garantir que passa `nomeParte` quando `tipo === 'parte'`

## Resultado Final

```
Monitoramento tipo "Polo passivo ou ativo":
  ✓ Uma única requisição por tribunal
  ✓ Sem variantes (busca exata)
  ✓ Sem rate limit (não duplica requisições)
  ✓ Explícito e claro na UI
```

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/utils/pjeComunicaClient.ts` | Adicionar `'parte'` ao tipo, suporte a `nomeParte` |
| `src/hooks/useDjenTermosEngine.ts` | Remover bloco `buscar_parte`, implementar `nomeParte` para tipo `'parte'` |
| `src/hooks/useBuscaDjenDireta.ts` | Adicionar opção `'parte'` |
| `src/components/djen/MonitoramentoDialog.tsx` | Remover checkbox, adicionar tipo `'parte'` no Select |
| `src/hooks/useMonitoramentosDjen.ts` | Remover `buscar_parte` da interface |
| `supabase/functions/buscar-pje/index.ts` | Adicionar tipo `'parte'` com `nomeParte` |
| `supabase/functions/monitorar-djen/index.ts` | Garantir suporte a `nomeParte` |
| `.lovable/memory/features/monitoring/djen-busca-nome-parte-v1.md` | Atualizar documentação |

