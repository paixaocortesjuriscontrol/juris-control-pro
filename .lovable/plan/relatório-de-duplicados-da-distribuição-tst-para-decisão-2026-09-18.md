# Relatório de duplicados da Distribuição TST para decisão

Nesta etapa nada é alterado na base: apenas a geração do relatório, começando pelo resumo executivo. Nenhum arquivamento será feito sem aprovação posterior.

## O que foi confirmado na base
- 26.745 fichas no total; 22.202 combinações únicas de processo + dossiê.
- 4.506 grupos duplicados, com 9.049 fichas envolvidas e 4.543 fichas excedentes.
- Se o arquivamento mantiver uma ficha por grupo, restam 22.202 fichas.
- 74 grupos têm ao menos uma ficha marcada como Pronto/Planilhado/Enviado; em 1 grupo existem duas fichas nessa condição.
- 73 grupos têm fichas com situações diferentes entre si.
- Origens predominantes: 4.411 fichas antigas sem aba (carga de situação de envio, 25/05/2026) e 4.241 fichas da Base PCA (07/08/2026); o restante vem das abas mensais (Resposta Santander / Planilha Distribuição) e da Certidão TST.

## Regra de segurança (obrigatória)
Nenhuma ficha marcada como Pronto, Planilhado ou Enviado é descartada. A escolha da ficha a manter segue esta ordem:
1. Ficha Pronto/Planilhado/Enviado.
2. Se houver mais de uma nessa condição, a ficha fica como decisão manual da advogada (nada é arquivado automaticamente).
3. Se nenhuma estiver pronta, mantém a mais completa (mais campos preenchidos: matérias, tipo de recurso, responsável, datas, análises).
4. Empate: mantém a mais antiga.

## Relatório entregue à advogada (Excel, várias abas)
1. **Resumo executivo** — totais, quantos ficam, quantos seriam arquivados, quantos exigem decisão manual, e os números por origem de carga.
2. **Decisão automática** — um bloco por grupo com processo, dossiê, responsável, situação, matérias, aba de origem, fonte da importação, data de distribuição, data de cadastro (BRT) e a coluna **Ação sugerida** (MANTER / ARQUIVAR) com o **motivo** da escolha.
3. **Decisão manual** — os grupos em que há mais de uma ficha pronta ou em que as fichas prontas divergem em dados importantes (responsável, matérias, tipo de recurso, situação): nenhuma sugestão de arquivamento, apenas comparação lado a lado para a advogada escolher.
4. **Risco de perda de dados** — grupos onde a ficha a arquivar tem informação que a ficha mantida não tem (matérias, tipo de recurso, responsável, análises), com a lista dos campos em risco.
5. **Por origem** — quantas duplicidades cada carga gerou, para corrigir a causa (Base PCA recadastrando processos existentes e abas mensais repetindo o mesmo processo).

Formatação profissional: fonte Arial, cabeçalhos com fundo escuro e texto branco, painéis congelados, filtros, datas em DD/MM/AAAA e horários em BRT, cores por ação (verde = manter, vermelho = arquivar, amarelo = decisão manual).

## Depois do relatório (só com o aval da advogada)
- Nenhuma alteração na base nesta etapa: o relatório é só para decisão.
- Quando aprovado, o arquivamento usa a tabela de arquivamento já existente (`dados_benner_arquivados`), registrando quem arquivou e o grupo de origem, sem apagar nada definitivamente.

## Detalhes técnicos
- Fonte: `dados_benner`, agrupando por número do processo sem pontuação + dossiê (mesma regra já usada no diagnóstico).
- Situações consideradas "prontas": `pronto_envio`, `planilhado`, `enviado`.
- Completude medida por contagem de campos preenchidos relevantes (responsáveis, matérias por parte, tipo de recurso, datas de julgamento, análises, TAGs).
- Arquivo gerado em `/mnt/documents` como `duplicados-distribuicao-tst-relatorio.xlsx`, com verificação de conteúdo antes da entrega.
