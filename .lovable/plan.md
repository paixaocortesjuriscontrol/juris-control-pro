## Nova rotina separada: **Buscar DJ Estadual**

Em vez de tentar empurrar TJMG/TJSP/etc. dentro do fluxo DJEN (que vive amarrado à API do PJE Comunica), crio um módulo **independente**, espelhado em "Buscar DJ Santander" / "Termos DJEN", com pipeline próprio: PDF do diário oficial → texto → busca de termos → matches.

O DJEN continua intocado para tudo que ele já cobre. Esta rotina cobre o que falta — começando por **TJMG**.

### Conceito

```
[Buscar DJ Estadual]
   ├─ Seleciona Tribunal (TJMG, TJSP, TJRS, ...)
   ├─ Seleciona Data (ou intervalo)
   ├─ Seleciona Caderno (Judicial 1ª/2ª, Administrativo)
   ├─ Termos a buscar (advogado/parte/palavra)
   └─ [Buscar]
        ↓
  baixar-dj-estadual  →  processar-dj-estadual  →  buscar-dj-estadual-termos
   (PDF → Storage)        (Jina → texto + CNJs)        (matches por termo)
        ↓
  Resultados na tela + opção de salvar como monitoramento recorrente
```

### Estrutura

**Página nova**: `src/pages/BuscarDjEstadual.tsx`
- Mesmo padrão visual de `TermosDjen.tsx` / `BuscarPJE.tsx`.
- Filtros: tribunal, data (ou range curto), caderno, termos (chips).
- Tabela de resultados: tribunal, data, caderno, página, processo CNJ (se detectado), trecho com termo destacado, link para abrir o PDF original (URL assinada do storage).
- Botão "Salvar como monitoramento" → cria registro em `monitoramentos_dj_estadual`.

**Rota**: adicionada em `src/App.tsx` e item de menu em `MonitoracaoHub` ("Buscar DJ Estadual").

### Backend (3 edge functions novas, isoladas)

1. **`baixar-dj-estadual`**
   - Input: `{ tribunal, data, caderno? }`.
   - Mapa `TRIBUNAIS_ESTADUAIS` em `_shared/djeEstaduaisTribunais.ts`:
     - **TJMG** primeiro: `https://dje.tjmg.jus.br/...` (caderno Judicial 1/2 instância e Administrativo). GET direto, sem cookie.
     - Stubs para TJSP, TJRS, TJPR, TJSC, TJBA, TJDFT, TJGO, TJES, TJPE, TJRJ — implementados sob demanda.
   - Salva PDF em bucket `dj-estaduais-pdfs`, registra em tabela `dj_estaduais_pdfs` (status=`baixado`).
   - Idempotente por `(tribunal, data, caderno)`.

2. **`processar-dj-estadual`**
   - Input: `{ pdf_id }` ou processa fila pendente.
   - Mesmíssimo pipeline do `processar-dje-pdf` atual: Jina extrai texto → quebra em páginas → regex CNJ → grava em `dj_estaduais_conteudo`.
   - Status do PDF vai para `processado`.

3. **`buscar-dj-estadual-termos`**
   - Input: `{ tribunal?, data?, dataInicio?, dataFim?, caderno?, termos: string[] }`.
   - Varre `dj_estaduais_conteudo` por `ILIKE`/`websearch_to_tsquery` em cima dos termos, retorna matches paginados com contexto (~250 chars antes/depois).
   - Sem dependência alguma do DJEN/PJE Comunica.

### Schema novo (3 tabelas + 1 bucket)

- `dj_estaduais_pdfs` — `tribunal`, `data_publicacao`, `caderno`, `storage_path`, `status` (baixado/processando/processado/erro), `total_paginas`, `erro_mensagem`. Unique `(tribunal, data_publicacao, caderno)`.
- `dj_estaduais_conteudo` — `pdf_id`, `pagina`, `conteudo_texto`, `processos_detectados text[]`. Unique `(pdf_id, pagina)`. Index GIN em `to_tsvector('portuguese', conteudo_texto)`.
- `monitoramentos_dj_estadual` — `tribunais text[]`, `cadernos text[]`, `termos jsonb`, `coordenacao_id`, `ativo`, `ultima_execucao`. Para a varredura recorrente.
- Bucket privado `dj-estaduais-pdfs` (não público; acesso via URL assinada).

RLS: leitura por usuários autenticados da coordenação dona do monitoramento; escrita só via service_role das edge functions.

### Cron diário

`cron.schedule('dj-estadual-diario', '0 10 * * *', ...)` (07:00 BRT) chama, em cascata:
1. `baixar-dj-estadual` para cada `(tribunal, caderno)` ativo em `monitoramentos_dj_estadual` da data corrente.
2. `processar-dj-estadual` para PDFs pendentes (limit 5 por chamada, paralelizando por tribunal).
3. `buscar-dj-estadual-termos` para cada monitoramento ativo, gravando matches em `notificacoes` (mesma tabela já usada hoje pelos outros monitoramentos) com origem `"DJ Estadual"`.

### O que **NÃO** muda

- `monitorar-djen`, `monitorar-djen-processos`, `useDjenTermos*` continuam idênticos.
- `dje_pdfs_diarios` / `dje_conteudo_indexado` (TRTs) seguem como estão — não misturo as duas rotinas para evitar regressão.
- Nada de UI no diálogo DJEN; estaduais aparecem como rotina paralela.

### Detalhes técnicos

- **Custo Jina**: TJMG diário ~500–1500 páginas. Para conter custo, na primeira versão indexo só páginas que contenham CNJ (regex pré-OCR via `pdftotext` rápido no edge não é viável em Deno; alternativa: indexa tudo, e na busca filtra). Decisão prática: **indexar tudo** no MVP (TJMG só) e medir; se ficar caro, adiciono pré-filtro por CNJ baixando o PDF e usando `pdf-parse` em uma função Node externa.
- **TJMG** publica em PDF baixável direto, sem CAPTCHA — confirmado.
- **TJSP** exige sessão; ficará na fase 2 usando proxy `pje-proxy` já existente.
- **Tipos**: `src/integrations/supabase/types.ts` é regenerado automaticamente após a migração.

### Ordem de entrega

1. Migração: tabelas + bucket + RLS.
2. `_shared/djeEstaduaisTribunais.ts` com TJMG.
3. Edge functions `baixar-dj-estadual`, `processar-dj-estadual`, `buscar-dj-estadual-termos`.
4. Página `BuscarDjEstadual.tsx` + rota + item de menu.
5. Smoke test manual: TJMG, data útil recente, termo "BRADESCO" → conferir matches.
6. Cron diário + criação de monitoramento recorrente.
7. Fase 2: TJSP, depois demais TJs sob demanda.