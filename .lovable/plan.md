

## Plano: Corrigir Vulnerabilidade de Segurança nos Convites de Cliente

### Problema
A tabela `convites_cliente` tem uma política RLS `Anyone can view invitation by token` com condição `USING (true)`, que expõe **todos** os convites (emails, tokens) para qualquer pessoa, inclusive não autenticada. Isso é uma falha de segurança grave.

### Contexto do fluxo atual
- A página `ClienteCadastro.tsx` consulta `convites_cliente` diretamente via Supabase client (anon key) filtrando por token — usuário não está autenticado neste momento
- A edge function `aceitar-convite-cliente` usa service_role, então não é afetada por RLS
- A edge function `enviar-convite-cliente` também usa service_role

### Solução

#### 1. Criar função `security definer` para buscar convite por token
Uma função no banco que recebe o token e retorna apenas os campos necessários (id, email, status, expira_em). Usa `security definer` para bypassar RLS com segurança.

```sql
CREATE FUNCTION public.get_convite_by_token(p_token uuid)
RETURNS TABLE(id uuid, email text, status text, expira_em timestamptz)
SECURITY DEFINER
```

#### 2. Remover a política pública
```sql
DROP POLICY "Anyone can view invitation by token" ON convites_cliente;
```

#### 3. Atualizar `ClienteCadastro.tsx`
Trocar a query direta na tabela por chamada à função RPC:
```typescript
const { data } = await supabase.rpc("get_convite_by_token", { p_token: token });
```

### Impacto
- **Zero quebra**: as edge functions usam service_role (ignoram RLS)
- **Admin continua funcionando**: política `Admins can view all invitations` permanece
- **Cadastro continua funcionando**: usa a função segura ao invés de query direta
- Tokens e emails deixam de ser expostos publicamente

### Arquivos alterados
- Migration SQL: criar função + remover política
- `src/pages/cliente/ClienteCadastro.tsx`: trocar query por RPC

