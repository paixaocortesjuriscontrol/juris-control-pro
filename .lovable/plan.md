## Objetivo

Pré-indexar as publicações em **Markdown estruturado** antes de enviá-las à IA, eliminando o "muro de texto" que hoje causa truncamento de pautas e respostas curtas demais. Sem alterar Resumo Rápido, sem migração de banco, sem mudança no provedor (continua OpenAI direto).

## Escopo

- `src/pages/AnaliseDjen.tsx` — formatador HTML→Markdown e segmentação de pautas no front (usado pelos botões "Gerar PDF Resumo" e "Gerar DOC Resumo").
- `supabase/functions/resumir-publicacoes/index.ts` — mesmo formatador no backend, antes da chamada à IA.
- Resumo Rápido (PDF/DOC) **não é alterado**.

## O que será construído

### 1. Formatador determinístico `htmlParaMarkdown(conteudo)`

Converte o HTML/texto bruto da publicação em Markdown legível pela IA, preservando estrutura:

- `<br>`, `<br/>`, `</p>`, `</div>` → quebra de linha real (`\n`).
- `<p>`, `<div>` de abertura → linha em branco antes do bloco.
- `<strong>`, `<b>` → `**texto**`.
- `<em>`, `<i>` → `*texto*`.
- `<ul>/<ol>/<li>` → lista Markdown (`- item`).
- Decodificação de entidades (`&nbsp;`, `&amp;`, `&lt;`, etc.).
- Remove tags restantes (`<[^>]+>`).
- Normaliza espaços **sem colapsar quebras de linha** (preserva `\n`, colapsa apenas espaços/tabs repetidos).
- Limita no máximo 2 quebras consecutivas.

### 2. Segmentador de pautas `segmentarPauta(markdown)`

Para publicações de pauta (TST/TRT), divide o documento em blocos por processo:

- Detecta cabeçalhos como `Processo Nº`, `AIRR-`, `RR-`, `AgInt-`, `ED-`, números CNJ, "Aditamento à Pauta", "Pauta de Julgamento".
- Retorna array de blocos `{ titulo, conteudoMd }`.
- Quando o usuário pediu o resumo de uma publicação, a IA recebe **apenas o bloco do processo relevante** (ou o bloco inteiro, caso curto), não o documento todo.
- Se não houver segmentação clara, usa o Markdown inteiro (fallback).

### 3. Integração no front (`AnaliseDjen.tsx`)

- Antes de enviar `conteudo` para `supabase.functions.invoke('resumir-publicacoes', ...)`, aplicar `htmlParaMarkdown` + (quando pauta) `segmentarPauta`, e mandar o Markdown estruturado em um novo campo `conteudoMd` (mantendo `conteudo` original por compatibilidade).
- Os fallbacks já implementados (`extractTrechoFinal` quando IA falha, `Detalhes da pauta` no `resumirTrechoPauta`) permanecem como rede de segurança.

### 4. Integração no backend (`resumir-publicacoes/index.ts`)

- Replicar `htmlParaMarkdown` e `segmentarPauta` em Deno.
- Se a request trouxer `conteudoMd`, usar direto. Se não, gerar a partir de `conteudo` (compatibilidade com chamadores antigos).
- Atualizar o prompt da IA para indicar que o input é Markdown estruturado por seções, instruindo-a a preservar relator, partes, advogados, intimados e despacho/decisão na resposta.
- `resumirPautaDeterministico` passa a operar sobre Markdown (campos vêm em linhas separadas, não no muro de texto), aumentando a taxa de match.

### 5. Resumo Rápido

Sem mudanças. As funções `extractTrechoPauta` / `extractTrechoFinal` continuam idênticas.

## Detalhes técnicos

- Formatador implementado como função pura, sem dependências novas (regex + replace). Mesmo código TS no front e Deno no backend (copy-paste consciente, com testes manuais nos dois lados).
- Segmentação: regex multiline para encontrar âncoras de processo; corta o Markdown nessas âncoras e associa cada slice ao número detectado.
- Tamanho máximo enviado à IA por chamada: bloco do processo + 500 caracteres de contexto antes/depois (evita explodir tokens em pautas com 200 processos).
- Logs: manter `console.info` no edge para amostrar tamanho original vs. tamanho Markdown vs. nº de blocos detectados nas primeiras 10 execuções.

## Validação

1. Rodar "Gerar PDF Resumo" no caso real de "Aditamento à Pauta TST" que motivou o ticket — confirmar que o resumo passa de 1 linha para o bloco completo (relator, partes, advogados, intimados).
2. Rodar em uma publicação comum (despacho/decisão) — confirmar que o resumo continua coerente e não regrediu.
3. Rodar "Gerar DOC Resumo Rápido" — confirmar que está idêntico ao comportamento atual (não foi tocado).
4. Conferir logs do edge para garantir que o Markdown está sendo recebido e que o número de blocos detectados em pautas é > 1.

## Fora do escopo

- Persistência do Markdown no Postgres (Opção B) — não será feito agora.
- Vetorização / pgvector (Opção C) — não será feito.
- Mudança de modelo ou provider de IA.
- Alteração visual nas telas.
