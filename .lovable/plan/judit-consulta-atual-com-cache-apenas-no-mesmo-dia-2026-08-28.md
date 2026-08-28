# Judit — Consulta atual com cache apenas no mesmo dia

## Decisão
O clique no botão Judit sempre busca dados atuais (crawler, `cache_ttl_in_days: 0`), **exceto** quando o mesmo processo já foi consultado com sucesso **no mesmo dia (data de hoje, fuso America/Sao_Paulo)**. Nesse caso reaproveita o resultado já gravado, evitando cobrança dupla por cliques repetidos no mesmo dia.

## Regra do cache
- Janela: **hoje** apenas. Ontem ou antes = consulta nova.
- Só reaproveita registro de `judit_logs` que seja da **instância TST** (na Distribuição TST) e com resposta completa/sucesso. Resposta de TRT ou incompleta nunca serve como cache.
- "Forçar atualização" ignora o cache do dia e sempre dispara o crawler.

## O que muda

### 1. Edge Function `buscar-judit`
- Substituir a validade atual de 3 dias por "mesmo dia civil (America/Sao_Paulo)".
- Manter o filtro de instância TST + resposta completa antes de aceitar o cache.
- Fora dessa janela: enviar `cache_ttl_in_days: 0` à Judit (crawler) e manter a retentativa dirigida ao TST.
- Continuar gravando `judit_logs` em toda consulta real (auditoria de custo/latência), marcando os hits de cache como não cobrados.

### 2. Frontend
- `DistribuicaoTstForm.tsx` e demais telas com botão Judit: indicar de forma discreta quando o dado veio do cache de hoje ("consultado hoje às HH:MM") e manter o botão "Forçar atualização" para busca imediata.
- Durante a consulta real, mensagem "buscando dados atualizados na Judit...".

## Impacto de custo
- Primeiro clique do dia em cada processo = 1 consulta cobrada.
- Cliques repetidos no mesmo dia = grátis.
- Tela **Consumo Judit** separa consultas reais de reaproveitamentos do dia.

## Verificação
- Clicar duas vezes no mesmo processo hoje: segunda resposta instantânea, sem novo registro cobrado.
- Clicar em processo consultado ontem: dispara crawler (~8–30s) e grava novo log.
- Conferir que respostas de instância TRT não são aceitas como cache na Distribuição TST.
