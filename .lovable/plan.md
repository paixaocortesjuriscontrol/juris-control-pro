# Diagnóstico

Os processos **0001281-69.2023.5.10.0005** e **0000081-65.2025.5.10.0002** existem no PDF do DEJT do TRT10 do dia 04/05/2026, mas a busca "Análise DJEN" não os encontra. Verifiquei direto no banco:

- `0000081-65.2025.5.10.0002` está presente no `conteudo` de 14 registros gravados (todos do dia 05/05/2026, monitoramentos diferentes), mas o `processo_numero` salvo é **`0000020-07.2025.5.10.0003`** (o primeiro CNJ do bloco). Por isso a busca por número não acha.
- `0001281-69.2023.5.10.0005` **não aparece em nenhum `conteudo`** — foi cortado fora.

Causa raiz no `useDjetPautasParalelaEngine.ts` (segmentador de pautas):

1. **Truncamento agressivo a 8000 chars** (`makePautaStreamSegmenter`, linhas 302–346 + `processBloco` em ~434): qualquer Sessão de Julgamento com muitos processos (uma sessão TRT10 lista facilmente 50+ feitos, ultrapassando 20–30 mil chars) é cortada em 8000 chars, perdendo todos os processos a partir desse ponto. É exatamente o caso do `0001281-69.2023.5.10.0005`, que aparece depois.
2. **`extractCnj` devolve só o primeiro CNJ** (`text.match(CNJ_REGEX)` linha 348-351). Como gravamos um único `processo_numero` por bloco, todos os processos da mesma Sessão somem do filtro por número (caso do `0000081-65...`, capturado no texto mas indexado com CNJ alheio).
3. Hoje cada hit gera 1 linha por monitoramento × bloco, então blocos enormes inflam por monitoramento e pioram o problema, em vez de gerar uma linha por processo dentro da pauta.

Os 14 registros de `0000081-65...` no `conteudo` confirmam que o PDF foi baixado e parseado — o problema é puramente do segmentador/persistência.

# Correções

### 1. Reescrever `useDjetPautasParalelaEngine.ts`
- Remover o cap de 8000 chars do `makePautaStreamSegmenter`. Acumular o bloco inteiro de cada Sessão até encontrar o próximo marcador (ou fim do PDF). Manter apenas um teto defensivo alto (ex.: 400 KB) para evitar runaway.
- Após segmentar a Sessão, **subdividir o bloco em sub-blocos por processo**:
  - Detectar todos os CNJs (`matchAll(CNJ_REGEX)`).
  - Para cada CNJ, recortar uma janela do texto (ex.: do CNJ atual até o próximo CNJ, ou ~3 KB de contexto se for o último), preservando o cabeçalho da Sessão (Turma, data/hora, órgão) que aparece antes do primeiro processo.
  - Cada sub-bloco vira uma `MatchOut` com `processo` correto.
- Trocar `processBloco(bloco)` para iterar nos sub-blocos por CNJ; aplicar `matchBlocoMonitoramento` em cada um.
- Atualizar o `hash` para `mon.id|tribunal|dataIso|processoCNJ|sub.slice(0,1024)` (mais granular, evita colapso entre processos da mesma Sessão).
- Se a Sessão não tiver nenhum CNJ (raro), manter o comportamento antigo: tratar o bloco inteiro como um match único.

### 2. Reprocessar 04/05 e 05/05/2026 do TRT10 (e idealmente todos os tribunais)
- Limpar registros antigos `fonte='dejt-pdf'` dos dias 2026-05-04 e 2026-05-05 via migração (DELETE com filtro), pois eles têm `processo_numero` errado.
- Reexecutar a DJET Pautas Paralela para o intervalo 04/05–05/05/2026 (botão "Executar" no card já existente).

### 3. Validação pós-correção
Conferir no banco:
```sql
select processo_numero, count(*)
from publicacoes_djen
where fonte='dejt-pdf'
  and data_publicacao between '2026-05-04' and '2026-05-05'
  and processo_numero in (
    '0001281-69.2023.5.10.0005',
    '0000081-65.2025.5.10.0002'
  )
group by 1;
```
Deve retornar ambos com pelo menos 1 linha cada (ou mais, conforme nº de monitoramentos casados).

# Arquivos afetados
- `src/hooks/useDjetPautasParalelaEngine.ts` — segmentador + persistência por processo.
- Nova migration SQL para apagar os registros mal indexados de 04–05/05/2026 (`fonte='dejt-pdf'`).

# Detalhes técnicos
- Sem mudança de schema; só dados.
- Não altera a edge function `buscar-dejt-pautas` (já entrega o PDF inteiro).
- Mantém compatibilidade com matchers atuais (`matchBlocoMonitoramento`, `condicaoConcomitanteAtendidaBloco`) — a única mudança é o tamanho/escopo do bloco passado.
