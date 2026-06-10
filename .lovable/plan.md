## Diagnóstico

Confirmado no banco: o processo **0000682-05.2016.5.23.0009** foi criado (id `c4617a6f-…`, coordenação `9d4e11e2-…`, criado hoje 13:01). Ou seja, o `ensureProcessoFromPublicacao` rodou. O motivo de "não aparecer" na tela Processos são **três bugs combinados**:

1. **Cache não é invalidado.** Nenhum dos dialogs do botão Adicionar (`PrazoDialog`, `CriarTarefaPublicacaoDialog`, `EventoDialog`, `NovaAudienciaPublicacaoDialog`) chama `queryClient.invalidateQueries(["processos-paginados"])` depois de criar o processo. A tela Processos usa cache de 5 min, então o processo recém-criado só aparece após refresh manual.

2. **Número salvo sem máscara CNJ.** No banco está `00006820520165230009` (20 dígitos puros). Quando o usuário busca por `0000682-05.2016.5.23.0009`, o `ILIKE '%…%'` do RPC não casa. O `formatProcessoNumero` deveria mascarar, mas o caminho atual está gravando os dígitos brutos vindos do DJEN.

3. **RPC de busca não normaliza dígitos.** `get_processos_paginados` faz só `p.numero ILIKE '%' || _search || '%'`. Mesmo se um processo estiver mascarado e o usuário buscar só dígitos (ou vice-versa), não acha.

## Correções

### 1. `src/lib/ensureProcessoFromPublicacao.ts`
- Garantir que `numero` salvo é **sempre** o formato CNJ mascarado quando houver 20 dígitos: usar `formatProcessoNumero(numeroDigits)` em vez de `formatProcessoNumero(numero) || numero`.
- Preencher `data_distribuicao` com `pub.data_publicacao` (ou hoje) para que o processo apareça em filtros padrão por período.
- Retornar também um flag `criado: boolean` para que os dialogs saibam quando invalidar caches.

### 2. Invalidação de cache nos 4 dialogs do "Adicionar"
Arquivos:
- `src/components/prazos/PrazoDialog.tsx`
- `src/components/djen/CriarTarefaPublicacaoDialog.tsx`
- `src/components/agenda/EventoDialog.tsx`
- `src/components/djen/NovaAudienciaPublicacaoDialog.tsx`

Depois do salvar bem-sucedido, executar em paralelo:
```ts
await Promise.all([
  queryClient.invalidateQueries({ queryKey: ["processos-paginados"] }),
  queryClient.invalidateQueries({ queryKey: ["processos"] }),
  queryClient.invalidateQueries({ queryKey: ["pastas"] }),
]);
```
(seguindo a regra de memória de aguardar `invalidateQueries` antes de fechar o diálogo).

### 3. Migração SQL — busca tolerante e backfill de números
Nova migration:

a) **Backfill** dos números existentes salvos como 20 dígitos sem máscara:
```sql
UPDATE public.processos
SET numero = format('%s-%s.%s.%s.%s.%s',
  substring(numero,1,7), substring(numero,8,2), substring(numero,10,4),
  substring(numero,14,1), substring(numero,15,2), substring(numero,17,4))
WHERE numero ~ '^[0-9]{20}$';
```

b) **Atualizar `get_processos_paginados`** para normalizar dígitos quando o `_search` contém só números (≥7 dígitos): comparar `regexp_replace(p.numero, '\D', '', 'g') ILIKE '%' || regexp_replace(_search, '\D','','g') || '%'` em adição à comparação atual. Mantém as buscas textuais (assunto/cliente/polos) inalteradas.

### 4. Fallback de polos (cosmético, mas resolve "Réu/Autor não identificado")
Em `ensureProcessoFromPublicacao`, se polo_ativo/polo_passivo da publicação estiverem vazios, tentar extrair do conteúdo (já existe util `pub.polo_ativo` — verificar se a publicação tem esses campos no banco e priorizar metadados estruturados antes do fallback genérico). Manter como melhoria opcional.

## Validação
1. Recarregar a tela Análise DJEN, criar prazo a partir de outra publicação cujo processo não exista.
2. Após salvar, abrir a aba Processos — o processo deve aparecer **sem F5** no topo da lista.
3. Buscar tanto pelo CNJ mascarado quanto pelos 20 dígitos puros — ambos devem encontrar.
4. Validar para o processo já existente `0000682-05.2016.5.23.0009`: após a migration ele aparece com máscara correta.

## Arquivos
- `src/lib/ensureProcessoFromPublicacao.ts`
- `src/components/prazos/PrazoDialog.tsx`
- `src/components/djen/CriarTarefaPublicacaoDialog.tsx`
- `src/components/agenda/EventoDialog.tsx`
- `src/components/djen/NovaAudienciaPublicacaoDialog.tsx`
- Nova migration SQL (backfill + atualização do RPC `get_processos_paginados`)
