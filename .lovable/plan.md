

# Aba "Partes" no Dados Benner — com persistência em tabela

## Resumo
Criar uma tabela `partes_processo_benner` para armazenar todas as partes (incluindo advogados) com CPF/CNPJ, tipo de pessoa e polo. Criar a aba "Partes" no detalhe do Dados Benner com botão Judit que busca e grava as partes.

## 1. Migration SQL — nova tabela

```sql
CREATE TABLE public.partes_processo_benner (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dados_benner_id uuid NOT NULL REFERENCES public.dados_benner(id) ON DELETE CASCADE,
  nome text NOT NULL,
  documento text,          -- CPF ou CNPJ (só dígitos)
  tipo_pessoa text,        -- REQUERENTE, REQUERIDO, ADVOGADO, TERCEIRO, etc.
  polo text,               -- Active, Passive, Interested
  is_advogado boolean DEFAULT false,
  origem text DEFAULT 'manual', -- 'judit' ou 'manual'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.partes_processo_benner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage partes"
  ON public.partes_processo_benner
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_partes_processo_benner_updated_at
  BEFORE UPDATE ON public.partes_processo_benner
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 2. Edge Function `buscar-judit/index.ts`

Adicionar `parties_detail` ao objeto `result` retornado (linha ~698):

```typescript
parties_detail: parties.map((p: any) => ({
  nome: p?.name || '',
  documento: p?.main_document || null,
  tipo_pessoa: p?.person_type || null,
  polo: p?.side || null,
  is_advogado: (p?.person_type || '').toUpperCase() === 'ADVOGADO',
})),
```

## 3. Novo componente `DadosBennerPartesTab.tsx`

- Recebe `dadosBennerId` e `processoNumero`
- Carrega partes existentes da tabela `partes_processo_benner` via query
- Exibe tabela com colunas: Polo, Tipo, Nome, CPF/CNPJ, Origem
- Linhas com `origem = 'judit'` ficam com fundo/borda verde (emerald)
- Botão "Buscar Judit" que:
  1. Chama `supabase.functions.invoke("buscar-judit", ...)`
  2. Recebe `parties_detail`
  3. Deleta partes anteriores com `origem = 'judit'` daquele `dados_benner_id`
  4. Insere as novas partes
  5. Recarrega a lista
- Permite adicionar/remover partes manuais
- Formata CPF (xxx.xxx.xxx-xx) e CNPJ (xx.xxx.xxx/xxxx-xx) na exibição

## 4. Atualizar `DadosBennerDetail.tsx`

- Adicionar tab "Partes" passando `dado.id` e `processoNumero`

## Arquivos afetados
- **Migration**: nova tabela `partes_processo_benner`
- **Editar**: `supabase/functions/buscar-judit/index.ts` (adicionar `parties_detail`)
- **Criar**: `src/components/benner/DadosBennerPartesTab.tsx`
- **Editar**: `src/components/benner/DadosBennerDetail.tsx` (nova aba)

