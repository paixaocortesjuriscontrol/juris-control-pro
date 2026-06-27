## Dedup de Pautas (Servidor + Browser) por coordenação + processo + conteúdo sem intimados

Apenas Pautas. Não toca em termos. Conteúdo gravado permanece completo, com intimados — a remoção dos intimados é só para calcular a chave de comparação.

### Arquivos
- `src/hooks/useDjetPautasParalelaEngine.ts`
- `supabase/functions/executar-djet-pautas-agendado/index.ts`

### Mudanças

1) Helpers locais nos dois arquivos:
```ts
const STRIP_RE = /(Intimad[ao]|Destinat[áa]rio|Advogad[ao]|Parte|Reclamante|Reclamad[ao]|Autor|R[eé]u|Requerente|Requerid[ao])\s*\(?s?\)?\s*:/i;
const stripIntimados = (t: string) => { const i = (t||"").search(STRIP_RE); return i > 0 ? t.slice(0, i) : (t||""); };
const digitsProcesso = (p?: string|null) => ((p||"").replace(/\D/g,"") || "sem-processo");
```

2) Hash gravado em `hash_conteudo`:
`sha256( coordenacao_id | digitsProcesso(processo) | normalize(stripIntimados(conteudo)) )`
- `normalize` = NFD + lowercase + colapso de espaços (`normalizeDjetText` já existe).
- `conteudo` salvo na linha continua sendo o texto completo do bloco (com intimados).

3) Dedup de existentes (em `persistMatches` de ambos os arquivos):
- `seen` local e lookup no banco passam a usar chave `coordenacao_id | hash_conteudo` (sem `monitoramento_id`), filtrando `tipo_publicacao='pauta'`.
- Tabela: `publicacoes_djen_servidor` quando `persist_mode=servidor`, senão `publicacoes_djen`.

4) Nada muda em termos, validação, datas, junction `publicacoes_djen_servidor_execucoes`, fonte (`dejt-pdf`), `tipo_publicacao` (`pauta`).

### Comportamento
- 1ª execução do dia grava tudo (conteúdo completo com intimados).
- 2ª execução com mesma coordenação+processo+conteúdo-sem-intimados: hash bate → conta como duplicada, não insere.
- Coordenações diferentes seguem independentes.
- Sem migração de banco.
