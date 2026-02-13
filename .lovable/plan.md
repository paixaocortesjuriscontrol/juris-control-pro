

## Plano: Armazenar texto extraido das 5 primeiras paginas no Supabase

### Objetivo
Salvar o texto extraido das primeiras 5 paginas do documento no banco de dados (tabela `documentos`) para que analises futuras leiam diretamente do banco, eliminando a necessidade de baixar e re-processar o PDF no navegador.

### 1. Migracao de banco de dados

Adicionar uma coluna `conteudo_extraido` (tipo `text`) na tabela `documentos` para armazenar o texto ja extraido:

```sql
ALTER TABLE public.documentos
  ADD COLUMN conteudo_extraido text,
  ADD COLUMN paginas_extraidas integer DEFAULT 0;
```

- `conteudo_extraido`: texto completo das primeiras 5 paginas (com marcadores `--- Pagina N ---`)
- `paginas_extraidas`: quantas paginas foram extraidas (para saber se o cache e valido)

### 2. Salvar texto durante o upload ou na primeira analise

No arquivo `ProcessoDetalhesCompletos.tsx`, na funcao `handleAnalyzeDocument`:

1. Antes de chamar a Edge Function, verificar se `doc.conteudo_extraido` ja existe
2. Se existir, usar esse texto diretamente (pula download + extracao PDF)
3. Se nao existir, extrair normalmente e salvar o resultado na coluna `conteudo_extraido` da tabela `documentos`

Fluxo simplificado:

```text
Clique "Analisar IA"
      |
      v
conteudo_extraido existe?
    /        \
  SIM        NAO
   |           |
   |      Download PDF
   |      Extrair 5 pags
   |      Salvar no BD
   |           |
   v           v
Enviar texto para Edge Function analisar-documento
```

### 3. Alteracoes no codigo

**Arquivo: `src/components/processos/ProcessoDetalhesCompletos.tsx`**

- Na query de documentos, incluir `conteudo_extraido, paginas_extraidas` no select
- Na funcao `handleAnalyzeDocument`:
  - Se `doc.conteudo_extraido` existir e `doc.paginas_extraidas >= 5`, usar direto
  - Caso contrario, extrair e salvar com `supabase.from("documentos").update({ conteudo_extraido, paginas_extraidas })`

### 4. Beneficios

- Primeira analise: mesma velocidade atual (extrai e salva)
- Analises seguintes: instantaneo (le do banco, sem download do PDF)
- Permite reanalisar documentos sem reprocessar o PDF
- Texto fica disponivel para buscas futuras no banco

### Detalhes tecnicos

- O texto das 5 paginas geralmente tem entre 5.000 e 30.000 caracteres, compativel com coluna `text` do Postgres
- Nenhuma RLS adicional necessaria pois a tabela `documentos` ja possui politicas existentes
- A coluna `paginas_extraidas` permite invalidar o cache se no futuro quisermos mudar o numero de paginas

