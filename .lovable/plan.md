# Pautas da Coordenação Dra. Renata Oficial — conferência e recuperação

## O que a conferência mostrou
- **13/10/2026 (busca de 04:30–05:01 BRT):** 229 publicações. Nenhuma é pauta de julgamento. As 16 que citam "pauta" são despachos de CEJUSC/conciliação ("pauta desta unidade", "pauta de conciliação"), acórdãos que mandam publicar "nova pauta de julgamento" ou citações a "Sessão Virtual" do STF dentro de decisões. Os documentos da Análise DJEN acertaram ao não colocar essas publicações em PAUTA.
- **10 a 12/10:** a coordenação não recebeu publicações (fim de semana e feriado).
- **09/10/2026:** 668 publicações, sendo 131 de pauta de julgamento (89 processos). **106 delas não estão na tela Pautas de Julgamento.** Elas tinham sido separadas pela rotina, mas foram apagadas na limpeza total antes da reimportação da planilha, que só ia até 06/11. É bem provável que o estranhamento dos advogados venha daí: as pautas da semana passada sumiram da tela.

## O que será feito
1. Rodar de novo a separação automática das publicações de 09/10/2026 (e de qualquer outro dia depois da limpeza). Só entram pautas que ainda não existem (mesmo processo e mesma data de julgamento), marcadas como "Auto DJEN · Nova".
2. Ligar essas pautas à Distribuição TST, completando dossiê, equipe e situação.
3. Entregar um relatório Excel com cada publicação de pauta de 09/10 e 13/10 e o que aconteceu com ela: entrou, já existia, ou ficou fora (e o motivo: acórdão, CEJUSC, sem número de processo).
4. Se os advogados apontarem um documento específico da Análise DJEN que pareceu estranho, conferir esse caso no relatório.

## Detalhes técnicos
- Executar `gerar_pautas_tst_auto(7)` e depois `vincular_pautas_distribuicao(NULL)`. Ambas já existem, deduplicam por `processo_digits + data_julgamento` e não mexem nas pautas da planilha.
- O relatório sai de uma consulta em `publicacoes_djen` filtrada por `coordenacao_id`, com `ILIKE '%pauta de julgamento%'`, cruzada com `pautas_tst`.
