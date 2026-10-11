# Pautas de Julgamento — limpar tudo e reimportar exatamente como a planilha

## De onde saíram as linhas a mais

A base hoje tem 2.563 pautas, de duas origens:

- **2.453 da planilha** (importadas em 07/04/2026): na época, a planilha só tinha abas até a semana de 18/05 a 22/05 — por isso a base para em 21/05/2026.
- **110 automáticas do DJEN** (criadas em 11/10/2026): são as pautas separadas automaticamente após a execução do DJEN Servidor, com julgamentos de 20/10 a 17/11/2026. São essas as linhas "além de 06/11" — elas não vieram da planilha.

A planilha enviada agora tem 34 abas (02/02 a 06/11/2026), ou seja, é a versão completa e atualizada.

## O que será feito

1. **Apagar todas as pautas** da tela (as 2.453 da planilha antiga e as 110 automáticas), junto com os responsáveis vinculados a elas.
2. **Reimportar a planilha enviada** (`Pautas_de_julgamento_2026_2_Coordenação_Dra._Renata-2.xlsx`), todas as 34 abas, exatamente como está: equipe, advogado interno, dossiê, número do processo, partes, tipo de recurso, data do julgamento etc.
3. **Semana fiel à aba:** cada pauta fica no intervalo exato da aba em que está na planilha (ex.: aba "02/02 a 06/02" → semana de 02/02/2026). A semana **não** será recalculada pela data do julgamento — vale o intervalo da aba.
3. As pautas importadas ficam marcadas como **avaliadas** (origem "planilha"), como antes.
4. **Manter a rotina automática do DJEN** funcionando: as próximas semanas (a partir de 09/11) continuarão entrando sozinhas como "A avaliar". Nenhuma pauta automática futura será apagada por esta limpeza.
5. Gerar uma **planilha de conferência** com o total importado por aba.

## Detalhes técnicos

- Apagar registros de `pautas_tst_responsaveis` e `pautas_tst` (todos), depois inserir os dados lidos das 34 abas via script, em lotes, com `semana_inicio` calculada pela data do julgamento.
- Linhas vazias da planilha são ignoradas; dossiês "não localizados" são mantidos como texto, como na planilha.
- Nada muda em telas, menus ou na rotina automática — apenas os dados.
