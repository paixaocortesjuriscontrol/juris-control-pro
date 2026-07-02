## Correção objetiva: filtros da Análise DJEN e busca por advogado/processo

Você tem razão em reclamar da tela: o problema agora está no **filtro/listagem**, não só na captura.

### Causa exata

1. As RPCs de listagem/totalizadores da **Análise DJEN** e **Análise DJEN Servidor** só comparavam o número digitado contra `processo_numero`.
2. Em editais coletivos, o processo procurado pode estar dentro do `conteudo` da publicação, não em `processo_numero`, então o filtro retornava zero mesmo com a publicação salva no banco.
3. A busca por advogado dependia de `ILIKE` simples, sensível a acento/variações, e não consultava bem `advogados_json`, `partes_json` e descrição do monitoramento.
4. Na **Análise DJEN Local**, o card “Execuções do dia” continuava filtrando por `execucaoFocada.novasIds`; quando o usuário mudava processo/advogado/data, esse foco antigo continuava escondendo resultados.
5. O card também não tinha botão de fechar de verdade; “Limpar filtro” apenas removia a seleção, mas o card ficava aberto.

### Implementação a fazer em build mode

#### 1. Nova migration SQL

Criar `supabase/migrations/20260702161000_fix_djen_analysis_search_filters.sql` redefinindo:

- `public.get_djen_publicacoes_unificadas`
- `public.get_djen_publicacoes_servidor_unificadas`
- `public.get_djen_stats_per_user`
- `public.get_djen_stats_servidor_per_user`

Mudanças nas quatro funções:

- Criar `v_q_digits`, `v_q_cnj` e `v_q_unaccent`.
- Para número de processo:

```sql
OR (v_q_cnj IS NOT NULL AND conteudo ILIKE ('%' || v_q_cnj || '%'))
OR (v_q_digits IS NOT NULL AND (
  regexp_replace(COALESCE(processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%')
  OR ((p_coordenacao_id IS NOT NULL OR p_data_disponibilizacao_inicio IS NOT NULL OR p_inicio IS NOT NULL)
      AND regexp_replace(COALESCE(conteudo, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
))
```

- Para advogado/nome:

```sql
OR lower(public.unaccent(COALESCE(advogados_json::text, ''))) LIKE ('%' || v_q_unaccent || '%')
OR lower(public.unaccent(COALESCE(partes_json::text, ''))) LIKE ('%' || v_q_unaccent || '%')
OR lower(public.unaccent(COALESCE(md.termo_busca, ''))) LIKE ('%' || v_q_unaccent || '%')
OR lower(public.unaccent(COALESCE(md.descricao, ''))) LIKE ('%' || v_q_unaccent || '%')
OR ((p_coordenacao_id IS NOT NULL OR p_data_disponibilizacao_inicio IS NOT NULL OR p_inicio IS NOT NULL)
    AND lower(public.unaccent(COALESCE(conteudo, ''))) LIKE ('%' || v_q_unaccent || '%'))
```

Observação de performance: busca no `conteudo` completo só deve entrar quando houver coordenação/data/criação filtrada, para não varrer a base inteira sem recorte.

#### 2. Corrigir foco antigo na Análise DJEN Local

Em `src/pages/AnaliseDjen.tsx`:

- Ao trocar coordenação, também limpar execução focada:

```tsx
useEffect(() => {
  setMonitoramentoId("");
  setTribunalFiltro("");
  setExecucaoFocada(null);
}, [coordenacaoId]);
```

- No efeito que reseta paginação/lista ao mudar filtros, incluir:

```tsx
setExecucaoFocada(null);
```

Assim o filtro por execução anterior não fica escondendo resultado quando o usuário procura advogado/processo/data.

#### 3. Corrigir foco antigo na Análise DJEN Servidor

Em `src/pages/AnaliseDjenServidor.tsx`, no efeito que reseta paginação/lista ao mudar filtros, incluir:

```tsx
setExecucaoFocada(null);
```

#### 4. Botão real para fechar o card de execuções locais

Em `src/components/djen/ExecucoesDoDiaLocalCard.tsx`:

- Importar `useEffect` e `useState`.
- Adicionar estado `dismissedKey` por `coordenação|data`.
- Se `dismissedKey === currentKey`, retornar `null`.
- Resetar `dismissedKey` ao mudar coordenação/data.
- Adicionar botão `X` sempre visível no título, chamando:

```tsx
onSelecionarExecucao(null);
setDismissedKey(currentKey);
```

### Resultado esperado

- Buscar pelo processo `0705967-44.2022.8.07.0001` ou apenas pelos dígitos deve encontrar edital coletivo mesmo quando o processo está no conteúdo.
- Buscar por advogado deve funcionar sem depender de acento/caixa e deve olhar campos estruturados e conteúdo quando houver filtro de data/coordenação.
- Trocar data/processo/advogado na Análise DJEN Local não continuará preso a uma execução antiga.
- O card de execuções anteriores poderá ser fechado.