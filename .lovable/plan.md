## Objetivo

Criar tela **"Busca Publicação"** dentro de Admin TST para varrer publicações no DJEN a partir de uma planilha de processos, período e tribunais. A execução roda nas VPS existentes (proxyPool), em um **novo engine independente** — sem tocar em `paralela.js` ou nos jobs de DJEN Termos Servidor.

## Fluxo do usuário

1. Acessa Admin TST → "Busca Publicação".
2. Faz upload de Excel com lista de processos (aceita coluna `Processo` ou `Número do Processo`; normaliza para 20 dígitos CNJ).
3. Escolhe período: `data_inicio` e `data_fim`.
4. Escolhe tribunais (multi-select, mesmo componente já usado nos monitoramentos DJEN — TST, STJ, TRTs, STF, TRFs, TJs, ou "Todos").
5. Clica "Iniciar busca" → cria job na nova fila; UI mostra progresso em tempo real (processos processados / total).
6. Ao concluir → botão "Baixar relatório Excel (2 abas)".

## Backend / Fila (nova, isolada)

**Nova tabela `buscas_publicacoes_execucoes`:**
- `id`, `criado_por`, `criado_em`, `status` (`pendente`|`em_execucao`|`concluida`|`erro`|`cancelada`)
- `data_inicio`, `data_fim` (date)
- `tribunais` (text[])
- `processos` (jsonb — array com `{numero_original, numero_digitos}`)
- `total_processos` (int), `processados` (int), `total_publicacoes` (int)
- `worker_id`, `iniciado_em`, `finalizado_em`, `erro_mensagem`
- `heartbeat_at`

**Nova tabela `buscas_publicacoes_resultados`:**
- `id`, `execucao_id` (FK), `processo_digitos`, `processo_original`
- `id_djen` (nullable), `tribunal`, `data_disponibilizacao`, `data_publicacao`
- `orgao`, `tipo_comunicacao`, `conteudo` (text), `raw_json` (jsonb)
- unique(`execucao_id`, `processo_digitos`, `id_djen`) quando `id_djen` presente; senão hash de conteúdo+data

Grants padrão + RLS (authenticated: leitura própria + admin TST; service_role: full).

**Nova RPC `lease_proxima_busca_publicacao`** — espelha `lease_proxima_execucao_servidor` mas na nova tabela. Não interfere com o lease existente.

## Engine no monitor-servidor (novo arquivo)

`monitor-servidor/engines/buscaProcessos.js`:
- `TIPO_ENGINE = "busca_publicacao_servidor"`.
- Lê job, distribui processos entre VPS via `djenFetchSlot` (mesmo `proxyPool`).
- Para cada processo × tribunal:
  - Chama `/comunicacao?numeroProcesso={digitos}&siglaTribunal={T}&dataDisponibilizacaoInicio&Fim` paginando até esvaziar (padrão `continueUntilEmpty`).
  - Se resultado vazio no número normalizado E o número tinha máscara, faz fallback com número original.
- Insere em `buscas_publicacoes_resultados` em batches de 200.
- Atualiza `processados` e `total_publicacoes` a cada N processos (heartbeat).
- Delays configuráveis via env (`BUSCA_PAGE_DELAY_MS`, etc.), independentes dos existentes.

`monitor-servidor/index.js`:
- Adicionar 1 linha em `ENGINES`: `busca_publicacao_servidor: require("./engines/buscaProcessos")`.
- O SLOTS já é gerado dinamicamente a partir de `ENGINES` → novo slot aparece automaticamente sem alterar lógica.

## Frontend

**Arquivos novos:**
- `src/pages/BuscaPublicacao.tsx` — upload Excel (SheetJS worker leve), pickers de data (shadcn), MultiSelect de tribunais (reutiliza opções de `djenTribunais.ts`), botão iniciar, painel de progresso (subscription realtime em `buscas_publicacoes_execucoes`), lista de execuções recentes do usuário.
- `src/lib/buscaPublicacaoExcelParser.ts` — extrai coluna de processo, normaliza dígitos (`replace(/\D/g,'')`), remove duplicatas, valida 20 dígitos.
- `src/lib/relatorioBuscaPublicacaoExcel.ts` — gera Excel 2 abas:
  - **Aba 1 "Resumo"**: `Processo | Qtd Publicações | 1ª Data | Última Data | Tribunais (lista)`
  - **Aba 2 "Detalhe"**: `Processo | Data Disponibilização | Data Publicação | Tribunal | Órgão | Tipo | Conteúdo`
  - Datas `DD/MM/YYYY`, ordenado por processo depois data.

**Arquivos editados:**
- `src/pages/AdminTst.tsx` — novo card "Busca Publicação" (ícone `Search`), descrição sobre upload de processos + período.
- `src/App.tsx` — rota `/admin-tst/busca-publicacao` com `AdminRoute`.

## Regras

- Motor Termos Servidor **não é tocado**: novo `TIPO_ENGINE`, nova tabela de fila, nova RPC de lease, novo arquivo de engine.
- Reuso apenas de infraestrutura genérica: `proxyPool.js`, `djenFetchSlot`, `makeSupabase`, `falhasRefila` (opcional).
- Normalização CNJ: `String(v).replace(/\D/g,'')`; se ≠ 20 dígitos, marca como "inválido" no relatório e não vai para VPS.
- Deduplicação por `id_djen` quando disponível; senão hash `numeroProcesso + data_disponibilizacao + conteudo`.
- Paginação com `continueUntilEmpty` (memória `djen-pagination-continueuntilempty`).
- Relatório considera apenas publicações inseridas na `buscas_publicacoes_resultados` do job — não mistura com `publicacoes_djen` de outros monitoramentos.

## Fora de escopo

- Não cria monitoramento recorrente.
- Não grava em `publicacoes_djen` (evita poluir base dos monitoramentos ativos).
- Não classifica/valida por termo — a busca aqui é puramente por número de processo.
