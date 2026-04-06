

## Problema

Na tela de Coordenações, os nomes dos membros aparecem como "Membro" ao invés do nome real. Isso acontece porque:

1. A view `profiles_basic` foi alterada para `security_invoker = true` (migration `20251209003234`)
2. Com `security_invoker`, a view respeita a RLS da tabela `profiles`
3. A RLS de `profiles` só permite ver o próprio perfil OU se for admin/coordenador
4. Katarine Dias (advogada comum) não consegue ver os nomes dos outros membros via `profiles_basic`
5. O código exibe `"Membro"` como fallback quando `member.usuario?.nome` é `undefined`

## Correção

Criar uma migration que recria a view `profiles_basic` com `security_invoker = false` (equivalente a `SECURITY DEFINER`). Essa view expõe apenas `id` e `nome` — dados não sensíveis que qualquer usuário autenticado precisa ver para a interface funcionar.

```sql
DROP VIEW IF EXISTS public.profiles_basic;

CREATE VIEW public.profiles_basic 
WITH (security_invoker = false)
AS
SELECT id, nome
FROM public.profiles;

GRANT SELECT ON public.profiles_basic TO authenticated;
```

Isso é seguro porque a view expõe apenas dois campos (id, nome) sem dados sensíveis como email ou telefone.

### Arquivo modificado
- Nova migration SQL (via ferramenta de database)

