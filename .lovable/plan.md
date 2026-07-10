## Objetivo

Trazer TODA a configuração de detecção automática e monitoramento para dentro do ícone de engrenagem de cada card de coordenação na Central de Notificações, de forma **isolada por coordenação**. E apagar tudo que foi detectado automaticamente até agora.

---

## Parte 1 — Limpeza dos dados detectados automaticamente

Vou apagar (permanente) tudo que veio de detecção automática, mantendo apenas o que foi criado manualmente/importado:

- `audiencias_detectadas` — apagar linhas com `origem IN ('djen_processos','monitoramento_djen_processos','monitoracao_360','monitorar-andamentos','monitorar-termos')`. Preservar `origem = 'manual'` e `origem = 'importacao'`.
- `intimacoes_detectadas` — mesma regra de origem.
- `alertas_monitoramento`, `alertas_processos_nao_cadastrados`, `alertas_coordenacao_djen` — apagar tudo (são todos gerados por robô).
- **Preservar:** `eventos_agenda`, `tarefas`, processos, publicações DJEN (as publicações em si continuam no histórico; só a detecção derivada delas é limpa).

Total estimado: ~316 audiências e o equivalente em intimações.

## Parte 2 — Configuração unificada por coordenação (engrenagem)

Hoje a engrenagem do card só configura alertas de e-mail/WhatsApp (`config_alertas_coordenacao`). Vou expandi-la para um diálogo com abas:

**Tabela nova `config_deteccao_coordenacao`** (uma linha por coordenação):

| Campo | Uso |
| --- | --- |
| `coordenacao_id` (UNIQUE) | vínculo |
| `detectar_audiencias` bool | liga/desliga gravação em `audiencias_detectadas` |
| `detectar_intimacoes` bool | idem para `intimacoes_detectadas` |
| `monitorar_andamentos` bool + `horarios_andamentos` time[] | DataJud/CNJ |
| `monitorar_djen_termos` bool + `horarios_djen_termos` time[] | DJEN por termos |
| `monitorar_djen_processos` bool + `horarios_djen_processos` time[] | DJEN por processo |
| `monitorar_distribuicoes` bool + `horarios_distribuicoes` time[] |  |
| `monitorar_redistribuicoes` bool + `horarios_redistribuicoes` time[] |  |
| `monitorar_djet_pautas` bool + `horarios_djet_pautas` time[] |  |

Diálogo da engrenagem (novo layout, abas):

1. **Alertas** (o que já existe hoje: e-mail, WhatsApp, horários de envio, tipos)
2. **Detecção automática** — 2 switches (audiências / intimações)
3. **Monitoramentos** — cada tipo com switch + horários (checkbox 00:00 → 23:00 em intervalos)

## Parte 3 — Aplicar isolamento nos jobs

Todos os edge functions/jobs (`monitorar-andamentos`, `monitorar-termos`, `monitorar-djen-processos`, `monitorar-distribuicoes`, `monitorar-redistribuicoes`, `processar-djet-pautas`) precisam:

1. Iterar por coordenação em vez de rodar global.
2. Ler `config_deteccao_coordenacao` da coordenação e pular se o tipo estiver desligado ou se o horário atual não bater.
3. Ao gravar em `audiencias_detectadas`/`intimacoes_detectadas`, respeitar `detectar_audiencias`/`detectar_intimacoes` da coordenação dona do processo.

A tela global "Monitoramento de Andamentos" em Configurações passa a ser **somente leitura / diagnóstico** (mostra o consolidado de todas as coordenações). A configuração viva fica na engrenagem.

---

## Confirmações antes de executar

1. **Apagar 316 audiências detectadas + intimações + alertas** é irreversível. Confirma?
2. Quando uma coordenação **não tiver** configuração ainda (linha nova em `config_deteccao_coordenacao`), o padrão deve ser **tudo desligado** (você habilita o que quiser) ou **tudo ligado com horários padrão**?
3. Manter a tela global de Configurações → Monitoramento como "somente diagnóstico" ou remover completamente?

Assim que confirmar, executo em 3 passos: (1) migration + limpeza dos dados, (2) UI da engrenagem com as abas, (3) ajuste dos edge functions para respeitar a configuração por coordenação.
