## Diagnóstico atual (confirmado)

- Motor `monitor-servidor/engines/stfServidor.js` grava STF em `publicacoes_djen` (`fonte='stf_digital'`) e chama `parseEnvolvidos(pub)` lendo **exclusivamente** `pub.envolvidos[]` da API `digital.stf.jus.br/.../publicacoes` para preencher `partes_json` / `advogados_json` / `polo_ativo` / `polo_passivo`.
- Consulta ao banco: das últimas 8 publicações `stf_digital` (7 dias), **todas** têm partes e advogados populados. O RHC 274998 do print **não está** em `publicacoes_djen` nem em `publicacoes_stf` — provavelmente é publicação criminal em que a API do STF devolve `envolvidos: []` (feitos com sigilo/segredo de justiça costumam vir sem partes/advogados estruturados).
- Diagnóstico da causa raiz está **não confirmado** — só saberemos após inspecionar o JSON bruto de uma publicação equivalente.

## Passo 1 — Confirmar a causa (obrigatório antes de corrigir)

Adicionar log temporário em `stfServidor.js` que, quando `parseEnvolvidos` retorna listas vazias, registre `pub.envolvidos`, `pub.partes`, `pub.polos`, `pub.processo`, `pub.tipo` no log da execução. Rodar em 1 ciclo e capturar 1–2 exemplos reais (incluindo, se possível, o RHC 274998 forçando busca por termo/processo). Objetivo: descobrir se o campo vem `[]`, com outro nome, ou preenchido só parcialmente.

## Passo 2 — Correção (condicional ao resultado do Passo 1)

Dois caminhos, escolhidos conforme o achado:

- **Se a API devolve `envolvidos` sob outro nome/estrutura** (ex.: `partes[]`, `polos.ativo[]`, `advogados[]` no topo do objeto): estender `parseEnvolvidos` para tentar essas chaves alternativas antes de desistir. Continua sendo parse de dado estruturado — sem regex no texto.
- **Se a API realmente não devolve nada estruturado para o processo** (típico em criminal/sigilo): parar de exibir “—” mudo. Renderizar em `AnaliseDjen.tsx` (bloco `PARTE(S)` / `ADVOGADO(S)`, ~linhas 2115 e 4941) uma mensagem explícita `Não informado pelo STF` quando `fonte === 'stf_digital'` e ambas as listas vierem vazias, para o usuário saber que é limitação da fonte, não bug.

Também executar um backfill leve: reprocessar as publicações `stf_digital` sem partes/advogados usando o `raw` retornado (se ainda disponível) ou refazendo o fetch pelo `stf_id`.

## Passo 3 — Verificação

- Rodar 1 execução STF servidor e conferir no banco que publicações com `envolvidos[]` populado continuam vindo com partes/advogados corretos (não pode regredir os 8/8 atuais).
- Abrir a UI e verificar: (a) publicação normal exibe partes/advogados; (b) publicação criminal sem envolvidos exibe a mensagem "Não informado pelo STF".

## Nada muda

- Nenhuma alteração no schema, nas RPCs de Análise DJEN, nos motores DJEN Termos/Pautas/Kurier ou na UI de outras fontes.
- Nenhum fallback por regex no corpo da decisão — a memória do projeto proíbe misturar parse de texto com metadados estruturados.

## Detalhes técnicos

- Arquivos a tocar: `monitor-servidor/engines/stfServidor.js` (log de diagnóstico + eventual expansão de `parseEnvolvidos`); `src/pages/AnaliseDjen.tsx` (mensagem "Não informado pelo STF" condicionada a `fonte==='stf_digital'`).
- Sem migrations. Sem mudança em contratos de tabela. Sem alteração no fluxo de duplicidade/descarte.
