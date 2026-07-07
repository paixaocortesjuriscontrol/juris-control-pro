## Objetivo

Adicionar botão **"Pautas Excel"** na tela **Coordenações** (ao lado de Atribuir / Reatribuir / Delegar Tarefa / Tarefa em Lote / Adicionar) que importa a planilha de pautas do modelo `EQUIPE_BEATRIZ_-_PAUTA_JULHO.xlsx`, cadastra os processos ausentes em **Processos e Casos** e cria as audiências vinculadas — todas aparecendo no **Painel de Controle** (Kanban de audiências) exatamente como uma inclusão manual.

## Colunas da planilha modelo (aba única, header na linha 1)

`DATA · HORA · NÚMERO DO PROCESSO · FORO · VT/CÂMARA · Local · COMARCA · UF · PÓLO ATIVO · CLIENTE · TERCEIRIZADA · TIPO · TELEPRESENCIAL · OBSERVAÇÕES/PROVIDÊNCIAS`

## Mapeamento planilha → banco

**Processos** (criados se `numero` normalizado não existir na coordenação):
- `numero` ← NÚMERO DO PROCESSO (mascarado)
- `tribunal` ← FORO · `orgao_julgador`/`vara` ← VT/CÂMARA
- `comarca` ← COMARCA · `uf` ← UF · `polo_ativo` ← PÓLO ATIVO
- `coordenacao_id` ← coordenação atual · `status` = `ativo` · `area` = `Trabalhista`

**Audiências** (`audiencias_detectadas`, sempre criadas — 1 linha = 1 audiência):
- `data_audiencia` ← DATA + HORA (timezone America/Sao_Paulo)
- `hora` ← HORA · `titulo` ← TIPO (ex.: "UNA PRESENCIAL")
- `processo_id`/`processo_numero` ← processo (existente ou recém-criado)
- `forum` ← FORO · `vara_camara`/`sala_forum` ← VT/CÂMARA
- `local_audiencia` ← Local (se ≠ "PENDENTE"/"TELEPRESENCIAL") · `comarca` ← COMARCA
- `polo_ativo` ← PÓLO ATIVO · `cliente` ← CLIENTE · `terceirizado` ← TERCEIRIZADA
- `modalidade` ← TELEPRESENCIAL (`Presencial`/`Virtual`) — link Zoom vai para `observacoes`
- `observacoes` ← OBSERVAÇÕES/PROVIDÊNCIAS (concat com link se houver)
- `coordenacao_id`, `criado_por`, `status='pendente'`, `origem='pauta_excel'`
- `advogados_ids` (via `audiencias_advogados`) ← responsáveis selecionados no diálogo

## Verificação de campos

Todos os campos já existem no schema — **não há migration**. O `EditarAudienciaDialog` já expõe `vara_camara`, `polo_ativo`, `cliente`, `terceirizado`. O formulário manual (`AudienciaFormSimplificado`) hoje **não** coleta esses campos; será atualizado para paridade com a importação e a edição.

## UX do diálogo Pautas Excel

1. Upload da planilha (drag-drop, aceita `.xlsx`).
2. Preview em tabela com contagem de linhas válidas / com erro (linha sem número de processo ou sem data é rejeitada).
3. Chip **"Coordenação: {atual}"** (readonly — usa a coordenação da tela).
4. **PeoplePicker obrigatório** "Responsáveis pelas audiências" — aplicado a todas as audiências da importação; bloqueio de importar se vazio.
5. Aviso na linha: `Processo novo` (verde) ou `Processo existente` (cinza) baseado em consulta prévia.
6. Botão **Importar** → progress bar sequencial (upsert processo → insert audiência → insert responsáveis).
7. Resumo final: `X processos criados · Y processos reutilizados · Z audiências criadas · N erros`.

## Arquivos a criar / alterar

**Criar**
- `src/components/coordenacoes/PautasExcelDialog.tsx` — dialog completo (upload, parser, preview, PeoplePicker de responsáveis, execução em lote).
- `src/lib/pautasExcelParser.ts` — leitura via `xlsx`, normalização de data+hora, máscara CNJ, split modalidade/link, detecção de linhas vazias.

**Alterar**
- `src/pages/Coordenacoes.tsx` — botão `Pautas Excel` (ícone `FileSpreadsheet`) entre "Tarefa em Lote" e "Adicionar"; state + render do dialog.
- `src/components/audiencias/AudienciaFormSimplificado.tsx` — adicionar campos `comarca`, `vara_camara`, `polo_ativo`, `cliente`, `terceirizado` (bloco "Detalhes do processo/audiência" colapsável) e persistir via `criarAudiencia` (o hook já aceita esses campos via `NovaAudiencia` — confirmar/estender tipo).
- `src/hooks/useAudienciasDetectadas.ts` (se necessário) — estender `NovaAudiencia` com os cinco campos acima; a persistência já grava em colunas existentes.

## Fluxo técnico

```text
xlsx → parser → linhas válidas
       │
       ├─ pré-consulta: SELECT id, numero FROM processos WHERE numero IN (...) AND coordenacao_id=?
       │
       ├─ INSERT processos ausentes  → mapa numero→id
       │
       └─ para cada linha:
            INSERT audiencias_detectadas (processo_id, ..., criado_por, coordenacao_id)
            INSERT audiencias_advogados  (audiencia_id, advogado_id) × responsáveis
```

O Painel de Controle já consulta `audiencias_detectadas` filtrando por `coordenacao_id`, então as audiências criadas aparecem automaticamente sem alterar a página.

## Regras de normalização

- Número CNJ: manter apenas dígitos, aplicar máscara `0000000-00.0000.0.00.0000` (skip se ≠ 20 dígitos e logar como erro).
- `TELEPRESENCIAL` = `PRESENCIAL` → modalidade `Presencial`; `TELEPRESENCIAL` → `Virtual`; qualquer outro → observação bruta e modalidade em branco.
- Local `PENDENTE` ou `TELEPRESENCIAL` → não preenche `local_audiencia`.
- `TERCEIRIZADA` = `NÃO` → grava `null`.
- Duplicidade de audiência (mesmo processo + mesma data/hora) → skip com aviso na tela.

## Não incluído neste plano

- Ajustes visuais no Kanban do Painel de Controle.
- Criação de partes (`processos_partes`) — apenas `polo_ativo` textual no processo, seguindo o padrão atual da importação de audiências.
- Alertas automáticos — herdam a configuração padrão de alertas de audiência da coordenação.
