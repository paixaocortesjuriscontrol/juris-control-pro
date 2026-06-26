## Plano de correção

Você está certo: para DJEN/PJE Comunica, a regra oficial deve ser **somente `coordenacao_id + id_djen`**. Nada de colapsar por conteúdo, processo, data, hash ou cabeçalho quando existe `id_djen`.

### 1. Corrigir a deduplicação visual da Análise DJEN Local e Servidor
- Ajustar `src/utils/djenDedup.ts` para que publicações com `id_djen` sejam deduplicadas exclusivamente por:
  - `coordenacao_id`
  - `id_djen`
- Remover o fallback visual por `processo + data + conteúdo` para publicações DJEN paralela com `id_djen`.
- Manter fallback apenas para fontes legadas sem `id_djen` se necessário, sem afetar DJEN/PJE Comunica.

### 2. Corrigir persistência do DJEN Browser/Local
- Em `src/hooks/useDjenTermosParalelaEngine.ts`, remover a checagem de duplicidade por:
  - `hash_conteudo`
  - `dedup_processo_digits`
  - `dedup_data_ref`
  - `dedup_head_norm`
- A checagem antes de inserir passará a ser só:
  - se tem `id_djen`: procurar `publicacoes_djen` por `coordenacao_id + id_djen`
  - se não tem `id_djen`: inserir como linha própria, sem bloquear outra publicação por conteúdo parecido
- A contagem de duplicadas também seguirá essa regra, para o card não esconder publicações reais.

### 3. Corrigir rotina legada de sincronização Browser
- Em `src/hooks/useSincronizarDjenBrowser.ts`, remover uso de `publicacoes_djen_global_hash` como dedup para publicações DJEN.
- Manter `id_djen` como chave única dentro da coordenação.
- Não registrar chave global por conteúdo para publicações que vêm do DJEN/PJE Comunica.

### 4. Corrigir pontos do Servidor que ainda usam hash como fallback indevido
- Em `monitor-servidor/engines/paralela.js`, manter o banco por `coordenacao_id + id_djen`, mas remover caminhos residuais que classificam como duplicada por `hash_conteudo` quando a publicação não deveria ser colapsada.
- O servidor continuará isolado: só lê/escreve `publicacoes_djen_servidor`.

### 5. Corrigir Edge Function legada `monitorar-djen`
- Em `supabase/functions/monitorar-djen/index.ts` e `processing.ts`, eliminar a pré-checagem por `hash_conteudo` para publicações DJEN com `id_djen`.
- Quando houver `id_djen`, o conflito será somente `coordenacao_id,id_djen`.

### 6. Auditar comparador e CSV
- Garantir que o comparador Servidor × Browser compare publicações por `coordenacao_id + id_djen`.
- Se aparecerem 3 `id_djen` diferentes com mesmo processo/texto, devem ser 3 publicações reais, não 1.

### Resultado esperado
- A mesma publicação pode repetir em coordenações diferentes.
- Dentro da mesma coordenação, só é duplicada se tiver o mesmo `id_djen`.
- Publicações com textos iguais, processo igual ou data igual, mas `id_djen` diferente, passam a aparecer e contar corretamente.
- Browser e Servidor deixam de divergir por deduplicação artificial de conteúdo.