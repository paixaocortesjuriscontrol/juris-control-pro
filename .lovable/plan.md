
# Plano: Sistema Paralelo de Monitoramento DJE via PDF

## Objetivo
Criar um sistema **totalmente independente** para baixar os PDFs diários dos tribunais (DJE), extrair o texto e fazer busca interna dos termos monitorados. Isso permitirá **comparar os resultados** com o sistema atual (DJEN via API) sem interferir em nenhuma rotina existente.

## Tribunais Identificados (Monitoramentos Ativos)
Com base nos dados atuais, os tribunais mais utilizados são:
- **TRT10** (32 monitoramentos)
- **STJ** (13)
- **TJDFT** (13)
- **TJGO** (13)
- **TRF1** (13)
- **STF** (9)
- **TJSP** (9)
- **TRT23** (14)
- **TRT24** (8)
- **TRF2-6** (25)
- **TST** (4)

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────────────────┐
│                    SISTEMA ATUAL (INALTERADO)                   │
│  monitorar-djen → buscar-djen → publicacoes_djen                │
│  monitorar-djen-processos → publicacoes_djen_processos          │
└─────────────────────────────────────────────────────────────────┘
                              ↕ PARALELO (COMPARAÇÃO)
┌─────────────────────────────────────────────────────────────────┐
│                    NOVO SISTEMA DJE-PDF                         │
│                                                                 │
│  1. baixar-dje-pdf    → Baixa PDFs dos tribunais               │
│  2. processar-dje-pdf → Extrai texto e indexa                  │
│  3. buscar-dje-interno→ Busca termos no texto indexado         │
│                                                                 │
│  Tabelas Novas (isoladas):                                      │
│  - dje_pdfs_diarios      (controle de downloads)                │
│  - dje_conteudo_indexado (texto extraído, indexado)             │
│  - dje_resultados_busca  (matches encontrados)                  │
└─────────────────────────────────────────────────────────────────┘
```

## Fases de Implementação

### Fase 1: Infraestrutura de Dados (Tabelas Isoladas)

Criar novas tabelas sem tocar nas existentes:

**`dje_pdfs_diarios`** - Controle dos PDFs baixados
- `id`, `tribunal`, `data_publicacao`, `caderno`
- `url_origem`, `tamanho_bytes`, `status` (pendente/baixado/processado/erro)
- `storage_path` (referência no Supabase Storage)
- `created_at`, `processado_em`

**`dje_conteudo_indexado`** - Texto extraído e fragmentado
- `id`, `pdf_id` (FK), `pagina`, `conteudo_texto`
- `processos_detectados[]` (array de números extraídos via regex)
- `created_at`

**`dje_resultados_busca`** - Matches encontrados (para comparação)
- `id`, `conteudo_id` (FK), `monitoramento_id` (FK para monitoramentos_djen)
- `termo_encontrado`, `contexto` (trecho de 500 chars)
- `processo_numero`, `pagina`
- `origem` ('dje_pdf') - para diferenciar do sistema atual
- `created_at`

### Fase 2: Download Automatizado de PDFs

**Edge Function: `baixar-dje-pdf`**

Lógica por tribunal (começando pelos mais usados):

| Tribunal | Fonte do PDF | Estratégia |
|----------|-------------|------------|
| TRT10, TRT23, TRT24 | DEJT (dejt.jt.jus.br) | API estruturada |
| STJ | Portal do STJ | Scraping da página de DJE |
| TJDFT | ejus.tjdft.jus.br | Download direto |
| TJSP | dje.tjsp.jus.br | Download por caderno |
| TRFs | Portais individuais | Varia por região |

**Fluxo:**
1. Verificar se PDF do dia já foi baixado
2. Baixar para Supabase Storage (bucket `dje-pdfs`)
3. Marcar como `pendente` para processamento
4. Executar via CRON às 7h (após publicação dos diários)

### Fase 3: Processamento e Extração de Texto

**Edge Function: `processar-dje-pdf`**

1. Buscar PDFs com status `baixado`
2. Usar biblioteca de extração de texto (pdf-parse ou similar)
3. Fragmentar por página para facilitar busca
4. Extrair números de processo via regex
5. Salvar em `dje_conteudo_indexado`
6. Marcar PDF como `processado`

**Considerações técnicas:**
- PDFs trabalhistas (DEJT) geralmente são texto puro
- Alguns PDFs podem requerer OCR (fallback com Tesseract via Jina)
- Limite de 50 segundos por invocação Edge Function
- Processamento em chunks se necessário

### Fase 4: Busca Interna dos Termos

**Edge Function: `buscar-dje-interno`**

1. Carregar monitoramentos ativos de `monitoramentos_djen`
2. Para cada termo, buscar em `dje_conteudo_indexado` usando:
   - `ILIKE` para palavra-chave/parte
   - Regex para OAB/advogado
3. Salvar matches em `dje_resultados_busca`
4. Não tocar em `publicacoes_djen` (sistema isolado)

### Fase 5: Interface de Comparação

**Novo componente: `ComparacaoDjenDje.tsx`**

Tela para visualizar lado a lado:
- Resultados do sistema atual (API DJEN)
- Resultados do novo sistema (DJE PDF)
- Métricas de comparação:
  - Quantos matches em comum?
  - Quantos exclusivos de cada sistema?
  - Tempo de execução de cada abordagem

Acessível em `/configuracoes` como nova aba experimental.

## Estimativas

### Volume de Dados (por dia)
| Tribunal | Tamanho PDF | Páginas | Tempo Download | Tempo Processamento |
|----------|-------------|---------|----------------|---------------------|
| TRT10    | ~5-15 MB    | 50-200  | 10-30s         | 30-60s              |
| TJDFT    | ~10-30 MB   | 100-400 | 20-60s         | 60-120s             |
| TJSP     | ~50-100 MB  | 500-2000| 60-180s        | 180-300s (chunks)   |
| STJ      | ~3-10 MB    | 30-100  | 10-20s         | 20-40s              |

**Total estimado:** 100-200 MB/dia, 30-60 minutos de processamento

### Storage
- ~3-6 GB/mês de PDFs
- Política de retenção: 30 dias (depois apaga)

## Cronograma Sugerido

1. **Semana 1:** Criar tabelas e bucket de storage
2. **Semana 2:** Implementar download para TRT10 + TJDFT (mais usados)
3. **Semana 3:** Processamento de texto e indexação
4. **Semana 4:** Busca interna e interface de comparação
5. **Semana 5+:** Expandir para outros tribunais conforme resultados

## Vantagens desta Abordagem

1. **Zero interferência** - Tabelas e funções completamente separadas
2. **Comparação direta** - Mesmos termos buscados nos dois sistemas
3. **Rollback fácil** - Se não funcionar, basta desativar
4. **Escalável** - Adicionar tribunais gradualmente
5. **Sem rate-limit** - PDF baixado uma vez, buscas ilimitadas

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| PDFs muito grandes (TJSP) | Processar em chunks, priorizar tribunais menores |
| Mudança no formato/URL dos PDFs | Monitorar erros, fallback manual |
| OCR necessário | Usar Jina API como fallback |
| Timeout Edge Function | Recursão com continuação automática |

## Seção Técnica

### Dependências Necessárias
- Nenhuma dependência nova no frontend
- Edge Functions usarão Deno fetch nativo para downloads
- Extração de texto via `pdf-parse` (Deno-compatible) ou Jina API

### Bucket Storage
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('dje-pdfs', 'dje-pdfs', false, 104857600); -- 100MB limit
```

### Índices Recomendados
```sql
CREATE INDEX idx_dje_conteudo_busca ON dje_conteudo_indexado 
USING gin(to_tsvector('portuguese', conteudo_texto));

CREATE INDEX idx_dje_resultados_termo ON dje_resultados_busca(termo_encontrado);
```

### Exemplo de URL DEJT (TRT)
```
https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=TRT10&data=2026-01-26&caderno=judiciario
```
