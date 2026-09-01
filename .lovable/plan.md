# Matéria do recurso da reclamada rejeitada na Carga Benner

## O que aconteceu (verificado no banco)

Processo `0020242-65.2024.5.04.0304` (dossiê `07.02.951.0003900445/24`):

- Recorrente: **Reclamante e Reclamada**
- Matéria do recurso da reclamada (banco): **"Horas extras intervalo intrajornada"**
- Matérias do recurso do reclamante: "Enquadramento como bancário" e "Responsabilidade solidária - grupo econômico"

Na tabela oficial `materias_pedidos_oficiais`:

- "Enquadramento como bancário" — existe
- "Responsabilidade solidária - grupo econômico" — existe
- "Horas extras intervalo intrajornada" — **não existe**. O nome oficial é **"Horas extras intrajornada"** (a palavra "intervalo" sobra)

Por isso a matéria da reclamada foi descartada como fora da lista oficial e a planilha saiu só com as matérias do reclamante. A advogada está certa: a matéria não foi para a planilha — e o motivo é a divergência de um único termo no nome.

## Correção proposta

1. **Dicionário de sinônimos de matérias**
   Nova tabela `materias_pedidos_sinonimos` (`sinonimo` normalizado -> `materia_oficial`). Antes de rejeitar uma matéria, o sistema procura o sinônimo e converte para o nome oficial, que é o que vai para a planilha.
   Sinônimos iniciais a cadastrar (a partir dos casos já vistos):
   - "Horas extras intervalo intrajornada" -> "Horas extras intrajornada"

2. **Sugestão automática por semelhança**
   Quando a matéria não bate exata nem por sinônimo, o sistema calcula a matéria oficial mais parecida e mostra na tela de Distribuição TST / mensagens da Carga Benner: "Matéria X fora da lista — você quis dizer Y?", com botão para corrigir o registro e (opcionalmente) gravar o sinônimo. Nada é convertido em silêncio sem confirmação.

3. **Relatório de matérias fora da lista**
   Painel na Carga Benner listando todas as matérias não oficiais em uso hoje, com contagem de processos e a sugestão oficial correspondente, para limpeza em lote.

4. **Correção deste processo**
   Ajustar a matéria do recurso da reclamada deste processo para o nome oficial "Horas extras intrajornada", para que ele entre corretamente na próxima geração da Carga Benner.

## Detalhes técnicos

- Nova tabela `public.materias_pedidos_sinonimos` (id, sinonimo_normalizado único, materia_oficial, criado_por, created_at), com GRANTs para `authenticated`/`service_role` e RLS (leitura para autenticados, escrita para admin/coordenador).
- `src/utils/materiasOficiais` (mesma normalização atual: sem acentos, minúsculas, espaços colapsados) ganha resolução em duas etapas: exata -> sinônimo. Fallback de sugestão por distância de Levenshtein/trigrama apenas para exibição.
- `CargaBennerFromDb.tsx`: as mensagens fixas passam a incluir a sugestão oficial ao lado de cada matéria rejeitada; o arquivo de rejeições ganha a coluna "Sugestão".
- `gerarPlanilhaBenner.ts` exporta sempre o nome oficial resolvido.
- `MateriasAnaliseList.tsx` sinaliza em amarelo matérias fora da lista com a sugestão inline.
