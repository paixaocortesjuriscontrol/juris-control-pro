

## Corrigir Barra de Progresso e Totalizadores do DJEN Termos Flash

### Problemas identificados

**1. Barra de progresso não acompanha a evolução real da busca**

Atualmente a porcentagem é calculada por unidades de trabalho `(dias × termos)`, e só avança **após** terminar 100% do processamento de um termo (que pode levar minutos por causa da iteração de tribunais, páginas e variantes). Resultado: a barra fica parada longos períodos e depois "salta".

Localização: `src/hooks/useDjenTermosFlashEngine.ts`, linhas ~1410-1449.

```ts
const completedBefore = diaIdx * monitoramentos.length + termoIdx;
const percentageBefore = round((completedBefore / totalOps) * 100); // antes do termo
// ... processarTermoPro (longo) ...
const percentageAfter  = round((globalCurrent / totalOps) * 100); // depois do termo
```

Além disso, `processarTermoPro` itera `tribunais × variantes (termos_or)` internamente sem reportar progresso parcial — então o card só vê movimento entre termos.

**2. Totalizadores não batem com a tela Análise DJEN**

O contador "✓ encontradas (não lidas)" do card mostra `progress.novas`, que é incrementado a cada `INSERT` em `publicacoes_djen` durante a execução. Discrepâncias com `/analise-djen` ocorrem por três razões reais:

- **Escopo diferente**: a tela Análise DJEN lista `publicacoes_djen` filtradas por coordenação/monitoramento/termo de busca, e por padrão ordena por `created_at` com **limite de 500 registros** (ver `useAnaliseDjen.ts` linha 95). O card Flash conta tudo que ele inseriu na sessão — sem filtro de coordenação, sem limite.
- **Momento da contagem**: `progress.novas` acumula apenas inserts feitos **nessa execução** do Flash. Se o usuário entra na Análise DJEN, ele vê a soma histórica + execuções de outros engines (Pro, scheduler backend, busca direta), por isso é normal o número da tela ser maior.
- **Filtros do Flash não refletidos**: quando o usuário roda o Flash com `coordenacaoId`/`monitoramentoIds`, o `progress.novas` ignora esses filtros para fins comparativos — não há um KPI "novas para esta coordenação no período" que possa ser confrontado diretamente com a tela Análise DJEN.

### Correções propostas

**A) Progresso fluido (granularidade fina)**

Sub-progresso dentro de cada termo. Em `processarTermoPro` (e funções correlatas), reportar progresso parcial entre tribunais/variantes:

1. Calcular `subUnits = tribunais.length * (variantesEsperadas)` antes de iniciar o termo.
2. A cada tribunal/variante concluída, calcular:
   ```
   percentage = round( ( (completedBefore + subDone/subUnits) / totalOps ) * 100 )
   ```
   e chamar `updateProgress({ percentage, mensagem: '...' })`.
3. Adicionar campo opcional `subProgress: { current, total }` no `DjenTermosFlashProgress` e mostrar no card uma linha auxiliar tipo "Tribunal 4/12 • TRT5".

Resultado: barra avança continuamente (sem saltos) e o usuário vê em tempo real qual tribunal está sendo varrido.

**B) Reconciliação dos totalizadores**

Para o card Flash bater com a tela Análise DJEN, alinhar duas coisas:

1. **No card Flash** — junto ao "✓ N encontradas (não lidas)", mostrar a janela e os filtros aplicados em texto pequeno: "no período `dd/mm` → `dd/mm`, coordenação X, termo Y". Isso deixa claro que o número se refere à execução em curso, não ao total histórico.
2. **Nova consulta de reconciliação** após a conclusão (ou durante, a cada N termos): contar diretamente em `publicacoes_djen`:
   ```sql
   SELECT count(*)
   FROM publicacoes_djen p
   JOIN monitoramentos_djen m ON m.id = p.monitoramento_id
   WHERE p.created_at BETWEEN <run_start> AND now()
     AND (m.coordenacao_id = <coord> OR <coord> IS NULL)
     AND (p.monitoramento_id = ANY(<ids>) OR <ids> IS NULL)
   ```
   Exibir no card como "Confirmado no banco: N" ao lado de "✓ N encontradas". Se houver divergência ≥ 1, exibir um aviso e um botão "Recontar".
3. **Botão "Abrir na Análise DJEN"** no card Flash, que navega para `/analise-djen?coord=<id>&dataInicio=<run_start>&dataFim=<run_end>` já com os mesmos filtros aplicados — para o usuário comparar visualmente.
4. **Opcional**: aumentar o limite de 500 da `useAnaliseDjen.ts` (ou paginar) para garantir que períodos com muitas publicações não sejam truncados na tela.

### Detalhes técnicos

- **Arquivos a alterar**:
  - `src/hooks/useDjenTermosFlashEngine.ts` — adicionar callback de sub-progresso em `processarTermoPro`; opcionalmente expor `subProgress` no tipo.
  - `src/components/configuracoes/MonitoramentoTermosFlashCard.tsx` — exibir tribunal atual, contagem confirmada do banco, link para Análise DJEN.
  - `src/hooks/useAnaliseDjen.ts` — reavaliar `limit(500)` (paginação ou aumento controlado).
- **Sem migrations**: ajustes só de UI/lógica frontend.
- **Compatibilidade**: o tipo `DjenTermosFlashProgress` ganha campos opcionais — não quebra consumidores existentes.
- **Complexidade**: Média. A parte mais delicada é instrumentar `processarTermoPro` sem alterar sua lógica de busca.

### O que será entregue após aprovação

1. Sub-progresso por tribunal dentro de cada termo, com a barra avançando suavemente.
2. Linha auxiliar no card mostrando "Tribunal X/Y • SIGLA".
3. Contador "Confirmado no banco" calculado por SELECT real em `publicacoes_djen`, exibido junto ao "✓ encontradas".
4. Botão para abrir a tela Análise DJEN já com os mesmos filtros (coordenação + período).
5. Decisão sobre o `limit(500)` da Análise DJEN (paginar ou ampliar).

Aprove para eu implementar, ou me diga qual subitem priorizar primeiro (ex.: só barra de progresso; só reconciliação dos totalizadores).

