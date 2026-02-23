# Memory: features/monitoring/djen-cross-monitoramento-rescue-v1
Updated: 23/02/2026

## Resgate Cross-Monitoramento

Quando dois monitoramentos buscam o mesmo advogado (ex: "OSMAR MENDES" com condição concomitante e "OSMAR MENDES PAIXAO CORTES" sem condição), a API pode retornar resultados diferentes devido a rate limiting ou timing. Publicações encontradas por um monitoramento e descartadas por `condicao_concomitante` podem ser válidas para outro monitoramento sem condição.

### Lógica:
1. Após processar todos os termos de um dia, buscar descartadas com `motivo_descarte = 'condicao_concomitante'`
2. Para cada descartada, verificar se algum monitoramento candidato (tipo advogado, SEM condição concomitante) contém o advogado no texto ou metadados
3. Aplicar exclusões do candidato antes de resgatar
4. Inserir como publicação válida via upsert (ignoreDuplicates)

### Arquivo alterado:
- `src/hooks/useDjenTermosEngine.ts` — bloco de resgate adicionado após o loop de termos do dia
