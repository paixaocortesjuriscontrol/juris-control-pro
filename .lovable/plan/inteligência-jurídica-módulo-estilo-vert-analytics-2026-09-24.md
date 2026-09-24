# Inteligência Jurídica (módulo estilo Vert Analytics)

## Objetivo

Criar no JurisControl uma camada de inteligência analítica sobre a base própria do escritório, cobrindo os quatro pilares que a Vert oferece: dashboards estratégicos, ofensores e tendências, previsão de resultado e propensão a acordo. Tudo calculado a partir dos dados que já existem na base — sem depender de serviço externo.

## O que já temos (verificado na base)

- `dados_benner`: resultado (ganhamos/perdemos), resultado_conhecido_provido/não_provido, posição da turma e do relator (favorável/desfavorável), chance_exito, matérias por dossiê, turma, relator, reclamante/reclamada, acordo, datas de distribuição e julgamento.
- `processos`: valor_causa, valor_condenacao, valor_pago, provisionamento (provável/possível/remoto), resultado, probabilidade, risco, parte contrária (cpf_cnpj_parte_contraria), pedidos.
- Já existe o módulo "Ajustar Chance por Turma/Relator" (Admin TST) — base para a previsão de resultado.

## O que será construído (por fases)

### Fase 1 — Dashboards estratégicos
Nova tela "Inteligência Jurídica" (menu Relatórios) com:
- Causas ganhas x perdidas por período, turma, relator, matéria e equipe.
- Índice de recuperação financeira: valor da causa x condenação x valor pago.
- Acordos: quantidade, percentual sobre o total e evolução mensal.
- Filtros por coordenação, equipe, período e tribunal.

### Fase 2 — Ofensores e tendências
- Ranking de reclamantes e advogados adversários que mais geram processos (quantidade, valores envolvidos, taxa de acordo e de derrota).
- Matérias/pedidos mais recorrentes e sua evolução mês a mês (tendência de alta/baixa).
- Alertas de tendência: matéria ou ofensor com crescimento anômalo no período.

### Fase 3 — Previsão de resultado (score)
- Score de chance de êxito por processo calculado do histórico real da base: combinação de turma + relator + matéria + tipo de recurso (taxa de provimento histórica de cada combinação).
- Exibido na ficha da Distribuição TST e em coluna na lista, com selo de confiança (alta/média/baixa) conforme o volume histórico disponível.
- Não substitui o preenchimento manual: o score é sugestão e o valor manual continua tendo prioridade.

### Fase 4 — Propensão a acordo (score)
- Score de propensão a acordo por processo: histórico de acordos do reclamante, do advogado adversário, da matéria e da fase processual.
- Lista "Oportunidades de acordo": processos com alta propensão e valores relevantes, ordenada pelo melhor momento de agir.

## Abordagem técnica

- Sem infraestrutura de machine learning neste momento: os scores são estatísticos (taxas históricas da própria base), calculados por funções RPC no banco — rápidos, auditáveis e sem custo de IA.
- Novas RPCs `get_inteligencia_*` (SECURITY DEFINER, STABLE) agregando os dados; telas novas em `src/pages/` e componentes em `src/components/inteligencia/`.
- Respeito às regras permanentes: isolamento por coordenação, horário BRT, nenhuma alteração nas regras de pendência/Carga Benner.
- Fases entregues incrementalmente; cada fase funciona sozinha.

## Limitações conhecidas

- A qualidade dos scores depende do volume e da consistência do histórico preenchido (resultado, acordo, valores). Onde o histórico for escasso, o selo de confiança indicará "baixa" em vez de inventar precisão.
- Valores financeiros só entram nos indicadores quando estiverem preenchidos no processo.
