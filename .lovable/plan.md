
# Corrigir Itens "warn" Restantes do Security Scan

## Itens identificados como "warn" e suas ações

### 1. SUPA_function_search_path_mutable (banco de dados)
Funções sem `SET search_path TO 'public'` são vulneráveis a "search path hijacking". As funções identificadas pelo Supabase linter que ainda não possuem esse parâmetro são:
- `calcular_primeiro_dia_util`
- `proximo_dia_util`
- `djen_diario_publicacoes_tsv_update`
- `get_publicacoes_contagens_por_monitoramento` (versão sem período)

**Ação:** Migração SQL recriando essas funções com `SET search_path TO 'public'`.

### 2. SUPA_extension_in_public (banco de dados)
A extensão `unaccent` está instalada no schema `public`. O Supabase recomenda mover extensões para o schema `extensions`. Esta é uma configuração gerenciada pelo Supabase internamente e **não pode ser alterada via migração** — é uma limitação da plataforma. O item será marcado como ignorado com a justificativa adequada.

### 3. verbose_error_messages (Edge Functions)
Logs detalhados em funções como `consultar-processo` e `buscar-djen` expõem informações internas (URLs de API, parâmetros de busca, estrutura de dados). Isso não representa risco crítico para este sistema interno, mas é boa prática. As funções de monitoramento precisam de logs para diagnóstico operacional — portanto, o item será marcado como **ignorado com justificativa**, já que remover logs de monitoramento prejudicaria a operação do sistema.

### 4. SUPA_auth_leaked_password_protection
Configuração manual no dashboard do Supabase — já foi orientado em mensagens anteriores. Será marcado como ignorado após confirmação do usuário de que já habilitou.

---

## Plano de execução

### Passo 1 — Migração SQL (search_path nas funções)
Criar uma migração que recrie as 4 funções com `SET search_path TO 'public'`, mantendo toda a lógica intacta.

### Passo 2 — Atualizar findings de segurança
- **`SUPA_extension_in_public`**: Marcar como ignorado — a extensão `unaccent` no schema `public` é uma limitação do Supabase, não configurável por migrations do usuário.
- **`verbose_error_messages`**: Marcar como ignorado — logs operacionais são necessários para monitorar o sistema de DJEN/tribunais. O sistema é interno (escritório de advocacia), minimizando o risco real.
- **`SUPA_auth_leaked_password_protection`**: Marcar como ignorado — é uma ação manual já orientada ao usuário.

### Técnico: SQL da migração
```sql
-- Fix calcular_primeiro_dia_util
CREATE OR REPLACE FUNCTION public.calcular_primeiro_dia_util(...)
  SET search_path TO 'public'
AS $function$ ... $function$;

-- Fix proximo_dia_util
CREATE OR REPLACE FUNCTION public.proximo_dia_util(...)
  SET search_path TO 'public'
AS $function$ ... $function$;

-- Fix djen_diario_publicacoes_tsv_update
CREATE OR REPLACE FUNCTION public.djen_diario_publicacoes_tsv_update()
  SET search_path TO 'public'
AS $function$ ... $function$;

-- Fix get_publicacoes_contagens_por_monitoramento (sem período)
CREATE OR REPLACE FUNCTION public.get_publicacoes_contagens_por_monitoramento()
  SET search_path TO 'public'
AS $function$ ... $function$;
```

### Resultado esperado
Após as correções, os únicos itens "warn" ainda ativos serão eliminados ou justificadamente ignorados. O scan de segurança ficará limpo nesse nível.
