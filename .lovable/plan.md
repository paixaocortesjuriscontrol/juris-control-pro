
# Plano: Importacao Dr. Renata (TST) + Aba TST no Detalhar Processo

## Contexto
A planilha "Distribuicoes TST 2025" possui 27 colunas especificas para controle de processos no Tribunal Superior do Trabalho. Muitas dessas colunas nao existem na tabela `processos` e precisarao ser criadas.

## Colunas da Planilha TST

| Coluna | Existe no BD? | Campo a criar |
|--------|--------------|---------------|
| DATA DA DISTRIBUICAO | Sim (`data_distribuicao`) | - |
| NUMERO DO PROCESSO | Sim (`numero`) | - |
| DOSSIE | Nao | `dossie_tst` |
| EQUIPE | Nao | `equipe_tst` |
| RECLAMANTE | Sim (`polo_ativo`) | - |
| RECLAMADA | Sim (`polo_passivo`) | - |
| RELATOR | Nao | `relator_tst` |
| RELATOR (+ OU -) | Nao | `relator_favorabilidade` |
| TURMA | Nao | `turma_tst` |
| TURMA (+ OU -) | Nao | `turma_favorabilidade` |
| PARTE RECORRENTE | Nao | `parte_recorrente_tst` |
| TIPO DE RECURSO DO RECLAMANTE | Nao | `tipo_recurso_reclamante` |
| MATERIAS RECURSO RECLAMANTE | Nao | `materias_recurso_reclamante` |
| APARELHAMENTO (reclamante) | Nao | `aparelhamento_reclamante` |
| CHANCE DE EXITO (reclamante) | Nao | `chance_exito_reclamante` |
| TIPO DE RECURSO DO BANCO | Nao | `tipo_recurso_banco` |
| MATERIAS RECURSO DO BANCO | Nao | `materias_recurso_banco` |
| APARELHAMENTO (banco) | Nao | `aparelhamento_banco` |
| CHANCE DE EXITO (banco) | Nao | `chance_exito_banco` |
| HONRA | Nao | `honra_tst` |
| TEMA | Nao | `tema_tst` |
| EXECUCAO | Nao | `execucao_tst` |
| MIDIA NEGATIVA | Nao | `midia_negativa_tst` |
| DECISAO (Analise do quarteirizado) | Nao | `decisao_quarteirizado` |
| RECURSO DE TERCEIROS | Nao | `recurso_terceiros_tst` |
| TRANSITO EM JULGADO? | Sim (`transitado_julgado`) | - |
| BENNER ATUALIZADO? | Nao | `benner_atualizado` |

---

## Etapa 1: Migracao de Banco de Dados

Adicionar 19 novas colunas na tabela `processos`:

```sql
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS dossie_tst text,
  ADD COLUMN IF NOT EXISTS equipe_tst text,
  ADD COLUMN IF NOT EXISTS relator_tst text,
  ADD COLUMN IF NOT EXISTS relator_favorabilidade text,
  ADD COLUMN IF NOT EXISTS turma_tst text,
  ADD COLUMN IF NOT EXISTS turma_favorabilidade text,
  ADD COLUMN IF NOT EXISTS parte_recorrente_tst text,
  ADD COLUMN IF NOT EXISTS tipo_recurso_reclamante text,
  ADD COLUMN IF NOT EXISTS materias_recurso_reclamante text,
  ADD COLUMN IF NOT EXISTS aparelhamento_reclamante text,
  ADD COLUMN IF NOT EXISTS chance_exito_reclamante text,
  ADD COLUMN IF NOT EXISTS tipo_recurso_banco text,
  ADD COLUMN IF NOT EXISTS materias_recurso_banco text,
  ADD COLUMN IF NOT EXISTS aparelhamento_banco text,
  ADD COLUMN IF NOT EXISTS chance_exito_banco text,
  ADD COLUMN IF NOT EXISTS honra_tst text,
  ADD COLUMN IF NOT EXISTS tema_tst text,
  ADD COLUMN IF NOT EXISTS execucao_tst text,
  ADD COLUMN IF NOT EXISTS midia_negativa_tst text,
  ADD COLUMN IF NOT EXISTS decisao_quarteirizado text,
  ADD COLUMN IF NOT EXISTS recurso_terceiros_tst text,
  ADD COLUMN IF NOT EXISTS benner_atualizado boolean;
```

---

## Etapa 2: Nova Aba de Importacao - Dr. Renata (TST)

**Arquivo**: `src/pages/ImportarProcessos.tsx`

Seguindo o padrao da aba "Dra. Janaina":

1. Adicionar estados: `renataFile`, `renataProcessos`, `renataImporting`, `renataProgress`, `renataBuscarAndamentos`, `renataCancelledRef`
2. Adicionar `TabsTrigger value="renata"` com icone `Gavel`
3. Criar funcao `parseRenataExcel()` que mapeia as 27 colunas da planilha para os campos do banco
4. Criar funcao `handleRenataImport()` com logica de upsert (atualiza se numero ja existe)
5. Renderizar `TabsContent value="renata"` com upload, selecao de coordenacao/membro/cliente, preview em tabela e botao importar
6. Adicionar template na `generateTemplates.ts`

**Mapeamento de colunas no parser**:
- `DATA DA DISTRIBUICAO` -> `data_distribuicao`
- `NUMERO DO PROCESSO` -> `numero`
- `RECLAMANTE` -> `polo_ativo`
- `RECLAMADA` -> `polo_passivo`
- Demais colunas -> campos TST novos (armazenados em `renataData`)

---

## Etapa 3: Aba TST na Tela de Detalhes do Processo

**Arquivo**: `src/pages/ProcessoDetalhes.tsx`

1. Adicionar nova `TabsTrigger value="tst"` com icone `Gavel` e label "TST"
2. Criar `TabsContent value="tst"` com formulario inteligente contendo todos os 19 campos TST
3. O formulario sera editavel e salvara diretamente na tabela `processos`

**Layout do formulario TST** (organizado em secoes):

- **Dados Basicos**: Dossie, Equipe, Relator, Relator (+/-), Turma, Turma (+/-), Parte Recorrente
- **Recurso do Reclamante**: Tipo Recurso, Materias, Aparelhamento, Chance de Exito
- **Recurso do Banco**: Tipo Recurso, Materias, Aparelhamento, Chance de Exito
- **Analise e Status**: Honra, Tema, Execucao, Midia Negativa, Decisao Quarteirizado, Recurso de Terceiros, Benner Atualizado

Cada secao tera campos Input/Textarea editaveis com botao "Salvar" para persistir as alteracoes.

---

## Etapa 4: Template de Planilha

**Arquivo**: `src/utils/generateTemplates.ts`

Adicionar template `renata` com as 27 colunas da planilha original e funcao `downloadRenataTemplate()`.

---

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/migrations/` | Nova migracao com 22 colunas |
| `src/pages/ImportarProcessos.tsx` | Nova aba Dr. Renata (TST) |
| `src/pages/ProcessoDetalhes.tsx` | Nova aba TST com formulario |
| `src/utils/generateTemplates.ts` | Template da planilha TST |
