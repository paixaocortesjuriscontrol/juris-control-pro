## O que o documento aponta (6 problemas) e o que a verificação mostrou

### 1. Datas de prazo aparecem 1 dia a menos na pasta do processo — CONFIRMADO
Banco (prazo "Manifestar sobre esclarecimentos do perito", processo 0000023-10.2026.5.10.0008): `data_vencimento = 04/08/2026`, `data_fatal = 05/08/2026` — exatamente como ela salvou.
A lista de Prazos da pasta mostra "03/08 · Fatal: 04/08" porque `ProcessoDetalhesCompletos.tsx` formata com `new Date("2026-08-05")`, que o navegador interpreta como meia-noite UTC e, em BRT, volta para o dia anterior. O card "Pendências do Processo" usa um parser seguro e por isso mostra 05/08 corretamente.

**Correção:** trocar o `formatDate`/`formatDateTime` dessa tela pelo parser local já existente no projeto (mesmo padrão do card de pendências) e padronizar os rótulos: "Limite: dd/MM" (data_vencimento) e "Fatal: dd/MM" (data_fatal), pois hoje o card chama a data fatal de "Vence" e a lista chama a data limite de "Vence".

### 2. "Publicado em 28/07" quando a publicação é do dia 29/07 — CONFIRMADO
A publicação real tem `data_disponibilizacao = 28/07` e `data_publicacao = 29/07`. O painel lateral da publicação (`PublicacaoSidePanel`) exibe 28/07 pelo mesmo efeito de fuso (registros gravados como `00:00:00Z`).

**Correção:** usar o parser de data ancorado ao meio-dia local (`parseDataPublicacaoLocal`, já existente) em todos os pontos que exibem data de publicação, e mostrar as duas informações: "Disp.: 28/07 · Pub.: 29/07".

### 3. Tarefa concluída continua pendente na pasta — CAUSA PROVÁVEL: itens duplicados em duas pastas
Há dois processos distintos com o mesmo conjunto de tarefas/prazos (mesmos títulos e datas):
- 0001123-34.2025.5.10.0008 (cadastrado como área "civil")
- 0000023-10.2026.5.10.0008 (área trabalhista)

Ex.: "Laudo pericial" está `cumprido` em um e `pendente` no outro; "Manifestar sobre esclarecimentos..." existe nos dois com as mesmas datas. Ao concluir em uma pasta, a cópia da outra continua pendente.

**Plano:** primeiro levantar (consulta) todos os pares duplicados dessa coordenação; apresentar a lista para decisão de qual pasta é a correta antes de qualquer exclusão. Em paralelo, revisar por que a criação a partir da publicação vinculou o item à pasta duplicada (resolução de processo por número).

### 4. Audiência salva a partir da publicação fica "Origem: Manual" e sem a publicação — CONFIRMADO
A audiência 0000554-84.2026.5.10.0012 foi gravada com `origem = 'manual'` e `publicacao_id = NULL`. No código, a criação só insere a linha na tabela de ligação quando `publicacaoTipoOrigem` está preenchido, e nunca grava `origem`/`publicacao_id` na própria audiência.

**Correção:** ao criar audiência a partir de uma publicação, gravar `origem = 'publicacao'`, `publicacao_id` e `conteudo_publicacao` na audiência, além da linha de ligação, e exibir a data da publicação no card da audiência.

### 5. "Salvei o prazo e a tarefa e a publicação sumiu" — CAUSA A CONFIRMAR
O botão "Salvar e ler" marca a publicação como `lida = true`; com o filtro padrão de não lidas/novas, ela deixa de aparecer na lista. Também existem 5 registros duplicados dessa mesma publicação (motores servidor e kurier), e o modo "somente únicas" pode esconder a que ela estava usando.

**Plano:** reproduzir o fluxo e, confirmada a causa, manter a publicação visível após salvar (marcada como "Tratada" com selo verde e contador de itens criados) em vez de removê-la da lista.

### 6. Publicações de processos cíveis na coordenação trabalhista — A INVESTIGAR
Ainda não confirmei a origem. Já é sintoma visível o processo 0001123-34.2025.5.10.0008 (numeração trabalhista .5.10) cadastrado com área "civil".

**Plano:** levantar as publicações do dia da coordenação com tribunal fora do escopo trabalhista, identificar qual monitoramento (termo/OAB/parte) as trouxe e aplicar filtro de escopo por tribunal/área conforme a regra já usada no monitoramento DJEN.

## Ordem de execução sugerida
1. Correções de exibição de data (itens 1 e 2) — rápidas e de baixo risco.
2. Vínculo da audiência com a publicação (item 4).
3. Publicação permanecer visível após salvar (item 5).
4. Relatório de duplicidades de pastas/tarefas para decisão (item 3).
5. Investigação do escopo cível (item 6).

## Detalhes técnicos
- `src/components/processos/ProcessoDetalhesCompletos.tsx`: `formatDate` usa `new Date(string)` — substituir por parser de data-only local.
- `src/components/shared/PublicacaoSidePanel.tsx` e `NovaAudienciaPublicacaoDialog.tsx`: `parseISO` em timestamp `00:00:00Z` — usar `parseDataPublicacaoLocal`.
- `src/components/audiencias/AudienciaFormSimplificado.tsx`: incluir `origem`/`publicacao_id`/`conteudo_publicacao` no payload de criação.
- `src/pages/AnaliseDjen.tsx`: `markPubComoLida` + filtros de não lidas/duplicadas definem o sumiço da publicação.
