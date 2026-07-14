Migração aprovada e executada — as três tabelas de junção (`audiencias_publicacoes`, `audiencias_publicacoes_processos`, `audiencias_publicacoes_descartadas`) já existem com RLS e GRANTs.

Falta agora aplicar as alterações de código (que exigem build mode):

## Alterações de código

### 1. `src/components/audiencias/AudienciaFormSimplificado.tsx`
- Adicionar prop `publicacaoTipoOrigem?: "termo" | "processo" | "descartada" | "datajud"`.
- No `handleSubmit` (branch de criação), **remover** `publicacao_id` do payload enviado a `criarAudiencia` (ele fica só para compatibilidade legada e não será mais usado).
- Após `criarAudiencia.mutateAsync(payload)` retornar com sucesso, se houver `publicacaoId` e `publicacaoTipoOrigem`, inserir na tabela de junção correta:
  - `termo` → `audiencias_publicacoes` (`{ audiencia_id, publicacao_id }`)
  - `processo` → `audiencias_publicacoes_processos` (`{ audiencia_id, publicacao_processo_id }`)
  - `descartada` → `audiencias_publicacoes_descartadas` (`{ audiencia_id, publicacao_descartada_id }`)
  - `datajud` → não vincula (não há tabela FK-compatível)
- Falha na inserção da junção só loga warning; não bloqueia o sucesso da criação.

### 2. `src/hooks/useAudienciasDetectadas.ts`
- Em `criarAudiencia.mutationFn`, parar de gravar `publicacao_id` no INSERT de `audiencias_detectadas` para evitar violação de FK quando a origem não é `termo`. A coluna legada permanece no schema mas fica sempre `null` a partir de agora — o vínculo passa a ser via junção.

### 3. `src/components/djen/NovaAudienciaPublicacaoDialog.tsx`
- Reverter o gate `tipo_origem === "termo"` aplicado antes.
- Voltar a passar `publicacaoId={publicacao?.id}` **sempre** e adicionar `publicacaoTipoOrigem={publicacao?.tipo_origem}` para o form.

Se aprovado, aplico os 3 patches em sequência.