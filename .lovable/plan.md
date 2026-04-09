

# Adicionar coluna "situacao_processo" na tabela dados_benner

## O que será feito

Criar uma nova coluna `situacao_processo` (TEXT, nullable) na tabela `dados_benner` para armazenar a situação do processo (ex: "Trânsito em Julgado", "Ativo", "Arquivado", etc.).

## Etapas

### 1. Migration SQL
```sql
ALTER TABLE dados_benner ADD COLUMN situacao_processo TEXT;
```

### 2. Atualizar o tipo TypeScript `DadoBenner` em `src/hooks/useDadosBenner.ts`
- Adicionar `situacao_processo: string | null` na interface

### 3. Atualizar o formulário `DadosBennerForm.tsx`
- Adicionar campo "Situação do Processo" no formulário (campo texto ou select com opções predefinidas)

### 4. Atualizar a listagem (se desejado)
- Exibir a coluna na tabela da tela Dados Benner
- Permitir filtro por situação do processo

## Detalhes técnicos
- Coluna TEXT sem restrição para flexibilidade
- Pode ser preenchida manualmente ou automaticamente pela funcionalidade "Verificar Trânsito em Julgado" (quando implementada)

