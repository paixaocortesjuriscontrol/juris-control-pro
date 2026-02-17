
# Problema: Advogados da publicação DJEN não aparecem no conteúdo salvo

## Diagnóstico preciso

A publicação foi capturada corretamente pelo sistema (o falso positivo de OAB é um problema separado). O problema reportado agora é: **os nomes dos advogados que constam na publicação DJEN não aparecem no conteúdo exibido**.

### Por que os advogados somem?

A API PJE Comunica retorna os advogados em campos estruturados do JSON, como:
- `pub.destinatarios[]` com `nome`, `oab`, `siglaUf`
- `pub.advogados[]`
- `pub.destinatarioNome`

No arquivo `src/utils/djenLikeConteudo.ts`, a função `buildDjenLikeConteudo` (linha 128) é responsável por montar o texto da publicação que será salvo no banco. Ela monta cabeçalho (Órgão, Data, Processo) e extrai partes do texto original — mas na **linha 193** há um comentário explícito bloqueando a injeção de dados de advogados:

```typescript
// NÃO injetar dados do monitoramento (termo/OAB/UF) na seção de advogados.
// O conteúdo deve refletir apenas o texto original da publicação DJEN.
```

Essa regra foi criada para evitar que o **nome do monitoramento** (ex: "OAB TODAS-15553") fosse injetado artificialmente. Mas ela é ampla demais: também impede a extração dos advogados **reais da publicação** que vêm nos metadados da API.

A função `collectMetaAdvogadoText(pub)` em `djenLikeConteudo.ts` linha 95 já existe e já coleta esses campos — mas ela só é usada na **validação** (linha 1074 de `useDjenTermosEngine.ts`), nunca para montar o conteúdo salvo.

Resultado:
- Publicação chega com `pub.destinatarios = [{nome: "ADELIO MENDES DOS SANTOS JUNIOR", oab: "15553", siglaUf: "PA"}]`
- `buildDjenLikeConteudo` ignora esse campo
- Banco salva sem seção de advogados
- Interface exibe publicação sem advogados

## O que NÃO vai mudar (conforme instrução do usuário)

- Publicações sigilosas (conteúdo vazio) **NÃO serão descartadas**. O sistema já as aceita via fallback de metadata (linha 1076-1082 do engine), e isso está correto.
- A regra de não injetar o **termo do monitoramento** como advogado permanece válida.

## Solução: extrair advogados reais dos metadados da API

### Arquivo: `src/utils/djenLikeConteudo.ts`

Adicionar a função `extractAdvogadosFromMeta(pub)` que percorre os campos estruturados da API e monta a lista de advogados reais da publicação no formato padrão.

A função deve cobrir os formatos conhecidos da API PJE Comunica:

```
pub.destinatarios[]     → { nome, oab/numeroOab/numeroInscricao, uf/siglaUf/ufOab }
pub.advogados[]         → { nome/nomeAdvogado, numeroOab/oab, siglaUf/uf }
pub.destinatarioNome    → string simples (campo já normalizado pelo optimizeItem)
pub.nomeAdvogado        → string simples
```

Na função `buildDjenLikeConteudo`, após o bloco de partes, adicionar:

```typescript
// Verificar se o texto original já contém seção de advogados
const jaTemAdvogados = /\b(?:Advogado[s]?:|ADV\.|OAB\s)/i.test(original);

if (!jaTemAdvogados) {
  const advsMeta = extractAdvogadosFromMeta(pub);
  if (advsMeta.length > 0) {
    sections.push('Advogados:\n' + advsMeta.join('\n'));
  }
}
```

A seção só é injetada quando o texto original **não contém** informações de advogados (evita duplicidade). Para publicações sigilosas com conteúdo vazio, o original será vazio e os metadados serão usados integralmente.

### Detalhe crítico: não confundir com dados do monitoramento

A função `extractAdvogadosFromMeta` extrai apenas dados do objeto `pub` retornado pela API — nunca do objeto `monitoramento`. Assim a regra original de integridade de dados é preservada: o conteúdo reflete o que o tribunal publicou, não o que foi configurado no monitoramento.

## Arquivo a modificar

**`src/utils/djenLikeConteudo.ts`** — único arquivo, mudança cirúrgica:

1. Adicionar função `extractAdvogadosFromMeta(pub: any): string[]` antes de `buildDjenLikeConteudo`
2. Chamar essa função dentro de `buildDjenLikeConteudo` para injetar seção de advogados quando o texto original não a contém

## Impacto

- Publicações novas passarão a exibir os advogados retornados pela API
- Publicações sigilosas (conteúdo vazio) terão a seção "Advogados:" preenchida com os metadados
- Publicações que já têm advogados no texto não são afetadas (guarda `jaTemAdvogados`)
- Nenhuma mudança na lógica de validação/descarte
- Nenhuma mudança no falso positivo de OAB (esse é um problema separado, a corrigir posteriormente)
